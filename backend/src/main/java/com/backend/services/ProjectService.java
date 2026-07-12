package com.backend.services;

import com.backend.dtos.ProjectDTO;
import com.backend.dtos.TaskDTO;
import com.backend.dtos.UserDTO;
import com.backend.entities.NotificationType;
import com.backend.entities.Project;
import com.backend.entities.Task;
import com.backend.entities.User;
import com.backend.events.InvitationEmailEvent;
import com.backend.events.NotificationEvent;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.repositories.ProjectRepository;
import com.backend.repositories.TaskRepository;
import com.backend.requests.ProjectCreateRequest;
import com.backend.util.AccessGuard;
import com.backend.util.CriticalPathMethodHelper;
import com.backend.util.EntityMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final UserService userService;
    private final TaskRepository taskRepository;
    private final FileStorageService fileStorageService;
    private final CriticalPathMethodHelper cpmHelper;
    private final EntityMapper entityMapper;
    private final AccessGuard accessGuard;
    private final ApplicationEventPublisher applicationEventPublisher;

    public ProjectService(
            ProjectRepository projectRepository,
            UserService userService,
            TaskRepository taskRepository,
            FileStorageService fileStorageService,
            CriticalPathMethodHelper cpmHelper,
            EntityMapper entityMapper,
            AccessGuard accessGuard,
            ApplicationEventPublisher applicationEventPublisher
    ) {
        this.projectRepository = projectRepository;
        this.userService = userService;
        this.taskRepository = taskRepository;
        this.fileStorageService = fileStorageService;
        this.cpmHelper = cpmHelper;
        this.entityMapper = entityMapper;
        this.accessGuard = accessGuard;
        this.applicationEventPublisher = applicationEventPublisher;
    }

    @Transactional(rollbackFor = Exception.class)
    public ProjectDTO createProject(ProjectCreateRequest request, Integer userId, List<MultipartFile> attachments) {
        if (projectRepository.existsByProjectKey(request.projectKey())) {
            throw new ValidationException("Project key already exists: " + request.projectKey());
        }

        var owner = userService.getRequiredUserById(userId);

        var attachmentUrls = (attachments != null && !attachments.isEmpty())
                ? fileStorageService.storeFiles(attachments)
                : new ArrayList<String>();

        var project = new Project();
        project.setProjectKey(request.projectKey());
        project.setSummary(request.summary());
        project.setDescription(request.description());
        project.setOwner(owner);
        project.setNextTaskNumber(1);
        project.replaceAttachments(attachmentUrls);

        var members = resolveMembersFromEmails(request.members(), owner, request.summary());
        project.replaceMembers(members);

        if (request.dependencies() != null && !request.dependencies().isEmpty()) {
            var dependencies = request.dependencies().stream()
                    .map(depKey -> projectRepository.findByProjectKey(depKey)
                            .orElseThrow(() -> new ValidationException("Dependency project not found: " + depKey)))
                    .collect(Collectors.toList());
            validateNoProjectCycles(project, dependencies);
            project.replaceDependencies(dependencies);
        }

        var savedProject = projectRepository.save(project);
        notifyNewMembersExcludingOwner(members, owner, savedProject);
        return convertToDTOWithCPM(savedProject);
    }

    @Transactional(readOnly = true)
    public ProjectDTO getProjectByKey(String projectKey, Integer userId) {
        var project = accessGuard.getAccessibleProject(projectKey, userId);
        return convertToDTOWithCPM(project);
    }

    @Transactional(readOnly = true)
    public Page<ProjectDTO> getAllProjectsPaginated(Integer userId, Pageable pageable) {
        var projects = projectRepository.findAllAccessibleByUserPaged(userId, pageable);

        // Batch fetch all tasks for projects in this page
        var projectIds = projects.getContent().stream().map(Project::getId).toList();
        if (projectIds.isEmpty()) {
            return projects.map(project -> convertToDTOWithCPM(project, List.of()));
        }
        // distinct(): the dependencies join-fetch can return the same Task instance multiple times.
        var allTasks = taskRepository.findByProjectIdsWithDetails(projectIds).stream().distinct().toList();
        var tasksByProjectId = allTasks.stream()
                .collect(Collectors.groupingBy(t -> t.getProject().getId()));

        return projects.map(project -> {
            var tasks = tasksByProjectId.getOrDefault(project.getId(), List.of());
            return convertToDTOWithCPM(project, tasks);
        });
    }

    @Transactional(readOnly = true)
    public List<ProjectDTO> getAllProjects(Integer userId) {
        var projects = projectRepository.findAllAccessibleByUser(userId);
        if (projects.isEmpty()) {
            return List.of();
        }

        var projectIds = projects.stream().map(Project::getId).toList();
        var allTasks = taskRepository.findByProjectIdsWithDetails(projectIds).stream().distinct().toList();
        var tasksByProjectId = allTasks.stream()
                .collect(Collectors.groupingBy(t -> t.getProject().getId()));

        return projects.stream()
                .map(p -> convertToDTOWithCPM(p, tasksByProjectId.getOrDefault(p.getId(), List.of())))
                .toList();
    }

    @Transactional(rollbackFor = Exception.class)
    public ProjectDTO updateProject(String projectKey, ProjectCreateRequest request, Integer userId, List<MultipartFile> attachments) {
        var project = accessGuard.getOwnedProject(projectKey, userId);

        project.setSummary(request.summary());
        project.setDescription(request.description());

        if (attachments != null && !attachments.isEmpty()) {
            var newAttachments = fileStorageService.storeFiles(attachments);
            project.addAttachments(newAttachments);
        }

        if (request.members() != null) {
            updateProjectMembersAndNotify(project, request.members());
        }

        if (request.dependencies() != null) {
            var dependencies = request.dependencies().stream()
                    .map(depKey -> projectRepository.findByProjectKey(depKey)
                            .orElseThrow(() -> new ValidationException("Dependency project not found: " + depKey)))
                    .collect(Collectors.toList());
            validateNoProjectCycles(project, dependencies);
            project.replaceDependencies(dependencies);
        }

        var updatedProject = projectRepository.save(project);
        notifyProjectMembersOfUpdate(updatedProject, userId);
        return convertToDTOWithCPM(updatedProject);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteProject(String projectKey, Integer userId) {
        var project = accessGuard.getOwnedProject(projectKey, userId);

        deleteAllProjectAttachmentsSilently(project);
        projectRepository.delete(project);
    }

    private Set<User> resolveMembersFromEmails(List<UserDTO> memberDTOs, User owner, String projectName) {
        var members = new HashSet<User>();
        members.add(owner);
        if (memberDTOs == null || memberDTOs.isEmpty()) return members;

        var emailsToFetch = memberDTOs.stream()
                .map(UserDTO::email)
                .filter(email -> email != null && !email.isBlank())
                .filter(email -> !email.equalsIgnoreCase(owner.getEmail()))
                .collect(Collectors.toSet());

        if (emailsToFetch.isEmpty()) return members;

        var usersByEmail = userService.findByEmailsAsMap(emailsToFetch);

        for (String email : emailsToFetch) {
            var user = usersByEmail.get(email);
            if (user != null) {
                members.add(user);
            } else {
                applicationEventPublisher.publishEvent(new InvitationEmailEvent(email, projectName, owner.getFullName()));
            }
        }

        return members;
    }

    private void updateProjectMembersAndNotify(Project project, List<UserDTO> memberDTOs) {
        var existingMembers = new HashSet<>(project.getMembers());
        var existingMemberIds = existingMembers.stream()
                .map(User::getId)
                .collect(Collectors.toSet());

        var owner = project.getOwner();
        var updatedMembers = resolveMembersFromEmails(memberDTOs, owner, project.getSummary());
        var updatedMemberIds = updatedMembers.stream()
                .map(User::getId)
                .collect(Collectors.toSet());

        project.replaceMembers(updatedMembers);

        for (var member : updatedMembers) {
            var isNewMember = !existingMemberIds.contains(member.getId());
            var isNotOwner = !member.getId().equals(owner.getId());
            if (isNewMember && isNotOwner) {
                notifyMemberAddedToProject(member, project);
            }
        }

        for (var member : existingMembers) {
            if (!updatedMemberIds.contains(member.getId()) && !member.getId().equals(owner.getId())) {
                notifyMemberRemovedFromProject(member, project);
            }
        }
    }

    private void notifyMemberRemovedFromProject(User member, Project project) {
        var message = "You have been removed from project: " + project.getSummary();
        applicationEventPublisher.publishEvent(new NotificationEvent(member, message, NotificationType.MEMBER_REMOVED, null));
    }

    private void notifyProjectMembersOfUpdate(Project project, Integer updaterId) {
        var link = "/projects?projectKey=" + project.getProjectKey();
        var message = "Project '" + project.getSummary() + "' has been updated";
        for (var member : project.getMembers()) {
            if (!member.getId().equals(updaterId)) {
                applicationEventPublisher.publishEvent(new NotificationEvent(member, message, NotificationType.PROJECT_UPDATED, link));
            }
        }
    }

    private void notifyNewMembersExcludingOwner(Set<User> members, User owner, Project project) {
        for (var member : members) {
            if (!member.getId().equals(owner.getId())) {
                notifyMemberAddedToProject(member, project);
            }
        }
    }

    private void notifyMemberAddedToProject(User member, Project project) {
        var message = "You have been added to project: " + project.getSummary();
        var link = "/projects?projectKey=" + project.getProjectKey();
        applicationEventPublisher.publishEvent(new NotificationEvent(member, message, NotificationType.PROJECT_INVITATION, link));
    }

    private void deleteAllProjectAttachmentsSilently(Project project) {
        deleteAttachmentsSilently(project.getAttachments());
        for (Task task : project.getTasks()) {
            deleteAttachmentsSilently(task.getAttachments());
            for (var comment : task.getComments()) {
                deleteAttachmentsSilently(comment.getAttachments());
            }
        }
    }

    private void deleteAttachmentsSilently(Collection<String> attachments) {
        fileStorageService.deleteFilesSilently(attachments);
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
                throw new ValidationException("Circular dependency detected: project cannot depend on itself");
            }
            if (visited.add(current.getId()) && current.getDependencies() != null) {
                queue.addAll(current.getDependencies());
            }
        }
    }

    private ProjectDTO convertToDTOWithCPM(Project project) {
        var tasks = taskRepository.findByProjectIdWithDetails(project.getId());
        return convertToDTOWithCPM(project, tasks);
    }

    /** Single canonical project mapping: sort tasks, enrich with CPM criticality, then map. */
    private ProjectDTO convertToDTOWithCPM(Project project, List<Task> tasks) {
        var taskDTOs = tasks.stream()
                .sorted(Comparator.comparingInt(Task::getTaskNumber))
                .map(entityMapper::toTaskDTO)
                .toList();

        var cpmTaskDTOs = cpmHelper.calculateTaskDTOsWithCPM(taskDTOs);
        return entityMapper.toProjectDTO(project, cpmTaskDTOs);
    }
}
