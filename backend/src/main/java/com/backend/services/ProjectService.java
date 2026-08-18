package com.backend.services;

import com.backend.dtos.ProjectDTO;
import com.backend.dtos.TaskDTO;
import com.backend.entities.NotificationType;
import com.backend.entities.Project;
import com.backend.entities.User;
import com.backend.exception.ValidationException;
import com.backend.mapper.EntityMapper;
import com.backend.repositories.ProjectRepository;
import com.backend.repositories.TaskRepository;
import com.backend.requests.ProjectRequest;
import com.backend.scheduling.SchedulingService;
import com.backend.security.AccessGuard;
import com.backend.services.RateLimitService.Bucket;
import com.backend.util.AfterCommit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final UserService userService;
    private final TaskRepository taskRepository;
    private final FileStorageService fileStorageService;
    private final SchedulingService schedulingService;
    private final EntityMapper entityMapper;
    private final AccessGuard accessGuard;
    private final NotificationService notificationService;
    private final EmailService emailService;
    private final RateLimitService rateLimitService;

    public ProjectService(ProjectRepository projectRepository,
                          UserService userService,
                          TaskRepository taskRepository,
                          FileStorageService fileStorageService,
                          SchedulingService schedulingService,
                          EntityMapper entityMapper,
                          AccessGuard accessGuard,
                          NotificationService notificationService,
                          EmailService emailService,
                          RateLimitService rateLimitService) {
        this.projectRepository = projectRepository;
        this.userService = userService;
        this.taskRepository = taskRepository;
        this.fileStorageService = fileStorageService;
        this.schedulingService = schedulingService;
        this.entityMapper = entityMapper;
        this.accessGuard = accessGuard;
        this.notificationService = notificationService;
        this.emailService = emailService;
        this.rateLimitService = rateLimitService;
    }

    // ======================== Reads ========================

    @Transactional(readOnly = true)
    public ProjectDTO getProjectByKey(String projectKey, Integer userId) {
        var project = accessGuard.getAccessibleProject(projectKey, userId);
        return toDto(project, taskRepository.findByProjectIdWithDetails(project.getId()).stream()
                .map(task -> entityMapper.toTaskDTO(task, null))
                .toList());
    }

    @Transactional(readOnly = true)
    public Page<ProjectDTO> getProjects(Integer userId, Pageable pageable) {
        var projects = projectRepository.findAllAccessibleByUserPaged(userId, pageable);
        var tasksByProjectId = loadTasksFor(projects.getContent());
        return projects.map(project ->
                toDto(project, tasksByProjectId.getOrDefault(project.getId(), List.of())));
    }

    // ======================== Writes ========================

    @Transactional(rollbackFor = Exception.class)
    public ProjectDTO createProject(ProjectRequest request, Integer userId, List<MultipartFile> attachments) {
        if (projectRepository.existsByProjectKey(request.projectKey())) {
            throw new ValidationException("Project key already exists: " + request.projectKey());
        }

        var owner = userService.getRequiredUserById(userId);

        var project = new Project();
        project.setProjectKey(request.projectKey());
        project.setSummary(request.summary());
        project.setDescription(request.description());
        project.setOwner(owner);
        project.setNextTaskNumber(1);

        var savedProject = projectRepository.save(project);

        // Attachments need the project id to be recorded against, so they are stored after the
        // project row exists.
        savedProject.replaceAttachments(
                fileStorageService.storeFiles(attachments, savedProject.getId(), userId));

        var resolution = resolveMembers(request.memberEmails(), owner, userId);
        savedProject.replaceMembers(resolution.members());
        applyDependencies(savedProject, request.dependencies(), userId);

        notifyMembersAdded(savedProject, resolution.members(), owner);
        sendInvitationsAfterCommit(resolution.unregisteredEmails(), savedProject.getSummary(), owner);

        return toDto(savedProject, List.of());
    }

    @Transactional(rollbackFor = Exception.class)
    public ProjectDTO updateProject(String projectKey, ProjectRequest request, Integer userId,
                                    List<MultipartFile> attachments) {
        var project = accessGuard.getOwnedProject(projectKey, userId);
        var owner = project.getOwner();

        boolean detailsChanged = !java.util.Objects.equals(project.getSummary(), request.summary())
                || !java.util.Objects.equals(project.getDescription(), request.description());

        project.setSummary(request.summary());
        project.setDescription(request.description());

        // PUT replaces: an attachment the client no longer lists has been removed. Previously this
        // endpoint only ever added, so removing a project attachment reported success and did
        // nothing.
        var previousAttachments = List.copyOf(project.getAttachments());
        var declared = request.attachments() == null ? List.<String>of() : request.attachments();
        fileStorageService.requireAttachmentsBelongTo(project.getId(), declared);
        var updatedAttachments = new ArrayList<>(declared);
        updatedAttachments.addAll(fileStorageService.storeFiles(attachments, project.getId(), userId));
        project.replaceAttachments(updatedAttachments);

        var addedMembers = new LinkedHashSet<User>();
        var removedMembers = new LinkedHashSet<User>();
        Set<String> unregistered = Set.of();

        if (request.memberEmails() != null) {
            var existing = new HashSet<>(project.getMembers());
            var resolution = resolveMembers(request.memberEmails(), owner, userId);
            unregistered = resolution.unregisteredEmails();

            var existingIds = existing.stream().map(User::getId).collect(Collectors.toSet());
            var updatedIds = resolution.members().stream().map(User::getId).collect(Collectors.toSet());

            resolution.members().stream()
                    .filter(member -> !existingIds.contains(member.getId()))
                    .filter(member -> !member.getId().equals(owner.getId()))
                    .forEach(addedMembers::add);
            existing.stream()
                    .filter(member -> !updatedIds.contains(member.getId()))
                    .filter(member -> !member.getId().equals(owner.getId()))
                    .forEach(removedMembers::add);

            project.replaceMembers(resolution.members());
        }

        if (request.dependencies() != null) {
            applyDependencies(project, request.dependencies(), userId);
        }

        var updated = projectRepository.save(project);
        deleteRemovedAttachmentsAfterCommit(previousAttachments, updatedAttachments);

        // One notification per person, and only for something they can actually see: a member who
        // was just invited does not also need "the project was updated", and nobody needs it when
        // only the member list changed.
        var pending = new ArrayList<NotificationService.Pending>();
        var link = "/projects?projectKey=" + updated.getProjectKey();
        for (var member : addedMembers) {
            pending.add(new NotificationService.Pending(member,
                    "You have been added to project: " + updated.getSummary(),
                    NotificationType.PROJECT_INVITATION, link));
        }
        for (var member : removedMembers) {
            pending.add(new NotificationService.Pending(member,
                    "You have been removed from project: " + updated.getSummary(),
                    NotificationType.MEMBER_REMOVED, null));
        }
        if (detailsChanged) {
            for (var member : updated.getMembers()) {
                if (!member.getId().equals(userId)) {
                    pending.add(new NotificationService.Pending(member,
                            "Project '" + updated.getSummary() + "' has been updated",
                            NotificationType.PROJECT_UPDATED, link));
                }
            }
        }
        notificationService.notifyAll(pending);
        sendInvitationsAfterCommit(unregistered, updated.getSummary(), owner);

        return toDto(updated, taskRepository.findByProjectIdWithDetails(updated.getId()).stream()
                .map(task -> entityMapper.toTaskDTO(task, null))
                .toList());
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteProject(String projectKey, Integer userId) {
        var project = accessGuard.getOwnedProject(projectKey, userId);

        var attachments = collectAllAttachments(project);
        projectRepository.delete(project);
        // Files come off disk only once the rows are really gone: unlinking first meant a failed
        // commit left the project intact with every attachment URL pointing at nothing.
        AfterCommit.run("delete attachments of project " + projectKey,
                () -> fileStorageService.deleteFilesSilently(attachments));
    }

    // ======================== Internals ========================

    private record MemberResolution(Set<User> members, Set<String> unregisteredEmails) {}

    /**
     * Turns member email addresses into users, collecting the ones that do not exist yet so they
     * can be invited after the transaction commits.
     */
    private MemberResolution resolveMembers(List<String> emails, User owner, Integer actorId) {
        var members = new LinkedHashSet<User>();
        members.add(owner);
        if (emails == null || emails.isEmpty()) {
            return new MemberResolution(members, Set.of());
        }

        var wanted = emails.stream()
                .map(UserService::normalizeEmail)
                .filter(email -> email != null && !email.isEmpty())
                .filter(email -> !email.equals(UserService.normalizeEmail(owner.getEmail())))
                .collect(Collectors.toCollection(LinkedHashSet::new));

        if (wanted.isEmpty()) {
            return new MemberResolution(members, Set.of());
        }

        var found = userService.findByEmailsAsMap(wanted);
        var unregistered = new LinkedHashSet<String>();
        for (var email : wanted) {
            var user = found.get(email);
            if (user != null) {
                members.add(user);
            } else {
                unregistered.add(email);
            }
        }

        if (!unregistered.isEmpty()
                && !rateLimitService.allow(Bucket.INVITATION, String.valueOf(actorId))) {
            // Each unregistered address triggers mail from a verified sender with caller-supplied
            // text in it, so the volume one user can generate has to be bounded.
            throw new ValidationException("Too many invitations sent. Please try again later.");
        }

        return new MemberResolution(members, unregistered);
    }

    /**
     * Resolves dependency project keys through the access guard.
     *
     * <p>Going through the guard is what stops a caller from writing a dependency row pointing at
     * another tenant's project, and makes "not found" indistinguishable from "no access" so the
     * endpoint is not an existence oracle over a small key namespace.
     */
    private void applyDependencies(Project project, List<String> dependencyKeys, Integer userId) {
        if (dependencyKeys == null) {
            return;
        }
        if (dependencyKeys.isEmpty()) {
            project.clearDependencies();
            return;
        }
        var dependencies = dependencyKeys.stream()
                .distinct()
                .map(key -> accessGuard.getAccessibleProject(key, userId))
                .toList();
        validateNoProjectCycles(project, dependencies);
        project.replaceDependencies(dependencies);
    }

    private void validateNoProjectCycles(Project project, List<Project> newDependencies) {
        if (project.getId() == null || newDependencies.isEmpty()) {
            return;
        }
        var visited = new HashSet<Integer>();
        var queue = new LinkedList<>(newDependencies);
        while (!queue.isEmpty()) {
            var current = queue.poll();
            if (current.getId().equals(project.getId())) {
                throw new ValidationException(
                        "Circular dependency detected: a project cannot depend on itself");
            }
            if (visited.add(current.getId())) {
                queue.addAll(current.getDependencies());
            }
        }
    }

    private void notifyMembersAdded(Project project, Set<User> members, User owner) {
        var link = "/projects?projectKey=" + project.getProjectKey();
        var pending = members.stream()
                .filter(member -> !member.getId().equals(owner.getId()))
                .map(member -> new NotificationService.Pending(member,
                        "You have been added to project: " + project.getSummary(),
                        NotificationType.PROJECT_INVITATION, link))
                .toList();
        notificationService.notifyAll(pending);
    }

    /**
     * Invitations go out only once the project really exists. Sending them inline meant a
     * validation failure later in the same method rolled the project back after the mail had
     * already left.
     */
    private void sendInvitationsAfterCommit(Set<String> emails, String projectName, User inviter) {
        if (emails == null || emails.isEmpty()) {
            return;
        }
        var inviterName = inviter.getFullName();
        AfterCommit.run("send project invitations", () ->
                emails.forEach(email -> emailService.sendInvitationEmail(email, projectName, inviterName)));
    }

    private java.util.Map<Integer, List<TaskDTO>> loadTasksFor(List<Project> projects) {
        var projectIds = projects.stream().map(Project::getId).toList();
        if (projectIds.isEmpty()) {
            return java.util.Map.of();
        }
        return taskRepository.findByProjectIdsWithDetails(projectIds).stream()
                .distinct()
                .collect(Collectors.groupingBy(
                        task -> task.getProject().getId(),
                        Collectors.mapping(task -> entityMapper.toTaskDTO(task, null), Collectors.toList())));
    }

    /** Single canonical project mapping: enrich the tasks with critical-path flags, then map. */
    private ProjectDTO toDto(Project project, List<TaskDTO> tasks) {
        var critical = schedulingService.criticalTaskKeys(tasks, LocalDate.now());
        var enriched = tasks.stream()
                .map(task -> task.withIsCritical(critical.contains(task.taskKey())))
                .toList();
        return entityMapper.toProjectDTO(project, enriched);
    }

    private List<String> collectAllAttachments(Project project) {
        var all = new ArrayList<String>(project.getAttachments());
        for (var task : project.getTasks()) {
            all.addAll(task.getAttachments());
            for (var comment : task.getComments()) {
                all.addAll(comment.getAttachments());
            }
        }
        return all;
    }

    private void deleteRemovedAttachmentsAfterCommit(List<String> before, List<String> after) {
        var removed = new ArrayList<>(before);
        removed.removeAll(new HashSet<>(after));
        if (removed.isEmpty()) {
            return;
        }
        AfterCommit.run("delete detached project attachments",
                () -> fileStorageService.deleteFilesSilently(removed));
    }
}
