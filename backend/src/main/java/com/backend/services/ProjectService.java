package com.backend.services;

import com.backend.daos.ProjectDAO;
import com.backend.daos.TaskDAO;
import com.backend.daos.UserDAO;
import com.backend.dtos.ProjectDTO;
import com.backend.dtos.TaskDTO;
import com.backend.dtos.UserDTO;
import com.backend.entities.NotificationType;
import com.backend.entities.Project;
import com.backend.entities.Task;
import com.backend.entities.User;
import com.backend.exception.AuthorizationException;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.util.ValidationUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class ProjectService {

    private final ProjectDAO projectDAO;
    private final UserDAO userDAO;
    private final TaskService taskService;
    private final TaskDAO taskDAO;
    private final NotificationService notificationService;
    private final FileStorageService fileStorageService;
    private final CriticalPathMethodHelper cpmHelper;

    public ProjectService(
            ProjectDAO projectDAO,
            UserDAO userDAO,
            TaskService taskService,
            TaskDAO taskDAO,
            NotificationService notificationService,
            FileStorageService fileStorageService
    ) {
        this.projectDAO = projectDAO;
        this.userDAO = userDAO;
        this.taskService = taskService;
        this.taskDAO = taskDAO;
        this.notificationService = notificationService;
        this.fileStorageService = fileStorageService;
        this.cpmHelper = new CriticalPathMethodHelper();
    }

    @Transactional
    public ProjectDTO createProject(ProjectDTO projectDTO, Integer userId, List<MultipartFile> attachments) {
        validateProjectDTO(projectDTO);

        if (projectDAO.existsByProjectKey(projectDTO.projectKey())) {
            throw new ValidationException("Project key already exists: " + projectDTO.projectKey());
        }

        var owner = userDAO.getUserById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        var attachmentUrls = (attachments != null && !attachments.isEmpty())
                ? fileStorageService.storeFiles(attachments)
                : new ArrayList<String>();

        var project = new Project();
        project.setProjectKey(projectDTO.projectKey());
        project.setSummary(projectDTO.summary());
        project.setDescription(projectDTO.description());
        project.setOwner(owner);
        project.setNextTaskNumber(1);
        project.setAttachments(attachmentUrls);

        var members = resolveMembersFromEmails(projectDTO.members(), owner);
        project.setMembers(new ArrayList<>(members));

        if (projectDTO.dependencies() != null && !projectDTO.dependencies().isEmpty()) {
            var dependencies = projectDTO.dependencies().stream()
                    .map(depKey -> projectDAO.getProjectByKey(depKey)
                            .orElseThrow(() -> new ValidationException("Dependency project not found: " + depKey)))
                    .toList();
            validateNoProjectCycles(project, dependencies);
            project.setDependencies(dependencies);
        }

        var savedProject = projectDAO.save(project);
        notifyNewMembersExcludingOwner(members, owner, savedProject);
        return convertToDTO(savedProject);
    }

    @Transactional(readOnly = true)
    public ProjectDTO getProjectByKey(String projectKey, Integer userId) {
        var project = projectDAO.getProjectByKey(projectKey)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.hasAccess(userId)) {
            throw new ResourceNotFoundException("Project not found");
        }

        return convertToDTOWithCPM(project);
    }

    @Transactional(readOnly = true)
    public List<ProjectDTO> getAllProjects(Integer userId) {
        var projects = projectDAO.getProjectsByUserId(userId);
        return projects.stream()
                .map(this::convertToDTOWithCPM)
                .toList();
    }

    @Transactional
    public ProjectDTO updateProject(ProjectDTO projectDTO, Integer userId, List<MultipartFile> attachments) {
        validateProjectDTO(projectDTO);

        var project = projectDAO.getProjectByKey(projectDTO.projectKey())
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.isOwner(userId)) {
            throw new AuthorizationException("Only project owner can update the project");
        }

        project.setSummary(projectDTO.summary());
        project.setDescription(projectDTO.description());

        if (attachments != null && !attachments.isEmpty()) {
            var newAttachments = fileStorageService.storeFiles(attachments);
            if (project.getAttachments() != null) {
                project.getAttachments().addAll(newAttachments);
            } else {
                project.setAttachments(newAttachments);
            }
        }

        if (projectDTO.members() != null) {
            updateProjectMembersAndNotifyNewMembers(project, projectDTO.members());
        }

        if (projectDTO.dependencies() != null) {
            var dependencies = projectDTO.dependencies().stream()
                    .map(depKey -> projectDAO.getProjectByKey(depKey)
                            .orElseThrow(() -> new ValidationException("Dependency project not found: " + depKey)))
                    .toList();
            validateNoProjectCycles(project, dependencies);
            project.setDependencies(dependencies);
        }

        var updatedProject = projectDAO.save(project);
        return convertToDTO(updatedProject);
    }

    @Transactional
    public void deleteProject(String projectKey, Integer userId) {
        var project = projectDAO.getProjectByKey(projectKey)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.isOwner(userId)) {
            throw new AuthorizationException("Only project owner can delete the project");
        }

        deleteAllProjectAttachmentsSilently(project);
        projectDAO.deleteProject(project);
    }

    private Set<User> resolveMembersFromEmails(List<UserDTO> memberDTOs, User owner) {
        var members = new HashSet<User>();
        members.add(owner);
        if (memberDTOs == null || memberDTOs.isEmpty()) return members;

        // Collect emails to fetch (excluding owner)
        var emailsToFetch = memberDTOs.stream()
                .map(UserDTO::email)
                .filter(email -> !email.equals(owner.getEmail()))
                .collect(Collectors.toSet());

        if (emailsToFetch.isEmpty()) return members;

        // Batch load all users in single query
        var usersByEmail = userDAO.findByEmailsAsMap(emailsToFetch);

        // Verify all requested users were found and add to members
        for (String email : emailsToFetch) {
            var user = usersByEmail.get(email);
            if (user == null) {
                throw new ValidationException("User with email " + email + " does not exist");
            }
            members.add(user);
        }

        return members;
    }

    private void updateProjectMembersAndNotifyNewMembers(Project project, List<UserDTO> memberDTOs) {
        var existingMemberIds = project.getMembers().stream()
                .map(User::getId)
                .collect(Collectors.toSet());

        var owner = project.getOwner();
        var updatedMembers = resolveMembersFromEmails(memberDTOs, owner);
        project.setMembers(new ArrayList<>(updatedMembers));

        for (var member : updatedMembers) {
            var isNewMember = !existingMemberIds.contains(member.getId());
            var isNotOwner = !member.getId().equals(owner.getId());
            if (isNewMember && isNotOwner) {
                notifyMemberAddedToProject(member, project);
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
        var link = "/projects/" + project.getProjectKey();
        notificationService.createNotification(member, message, NotificationType.PROJECT_INVITATION, link);
    }

    private void deleteAllProjectAttachmentsSilently(Project project) {
        deleteAttachmentsSilently(project.getAttachments());
        for (Task task : project.getTasks()) {
            deleteAttachmentsSilently(task.getAttachments());
        }
    }

    private void deleteAttachmentsSilently(List<String> attachments) {
        if (attachments == null) return;
        for (String attachment : attachments) {
            try {
                fileStorageService.deleteFile(attachment);
            } catch (Exception ignored) {
            }
        }
    }

    private void validateProjectDTO(ProjectDTO projectDTO) {
        if (ValidationUtil.isNullOrEmpty(projectDTO.projectKey()) ||
                ValidationUtil.isNullOrEmpty(projectDTO.summary())) {
            throw new ValidationException("Project key and summary are required");
        }

        if (!projectDTO.projectKey().matches("^[A-Z][A-Z0-9]*$")) {
            throw new ValidationException(
                    "Project key must start with a letter and contain only uppercase letters and numbers");
        }

        if (projectDTO.summary().length() > ValidationUtil.MAX_SUMMARY_LENGTH) {
            throw new ValidationException("Summary exceeds maximum length of " + ValidationUtil.MAX_SUMMARY_LENGTH + " characters");
        }

        if (projectDTO.description() != null && projectDTO.description().length() > ValidationUtil.MAX_DESCRIPTION_LENGTH) {
            throw new ValidationException("Description exceeds maximum length of " + ValidationUtil.MAX_DESCRIPTION_LENGTH + " characters");
        }
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

    private ProjectDTO convertToDTO(Project project) {
        var tasks = project.getTasks() != null
                ? project.getTasks().stream().map(taskService::convertToDTO).toList()
                : new ArrayList<TaskDTO>();

        var members = project.getMembers() != null
                ? project.getMembers().stream().map(this::convertUserToDTO).toList()
                : new ArrayList<UserDTO>();

        var ownerDTO = convertUserToDTO(project.getOwner());

        var dependencyKeys = project.getDependencies() != null
                ? project.getDependencies().stream().map(Project::getProjectKey).toList()
                : new ArrayList<String>();

        var attachments = project.getAttachments() != null
                ? new ArrayList<>(project.getAttachments())
                : new ArrayList<String>();

        return new ProjectDTO(
                project.getId(),
                project.getProjectKey(),
                project.getSummary(),
                project.getDescription(),
                tasks,
                members,
                attachments,
                ownerDTO,
                dependencyKeys
        );
    }

    private ProjectDTO convertToDTOWithCPM(Project project) {
        var tasks = taskDAO.getTasksByProjectIdWithDetails(project.getId());
        tasks.sort(Comparator.comparingInt(Task::getTaskNumber));

        var taskDTOs = tasks.stream()
                .map(taskService::convertToDTO)
                .toList();

        var updatedTaskDTOs = cpmHelper.calculateTaskDTOsWithCPM(taskDTOs);

        var members = project.getMembers().stream()
                .map(this::convertUserToDTO)
                .toList();

        var dependencyKeys = project.getDependencies() != null
                ? project.getDependencies().stream().map(Project::getProjectKey).toList()
                : new ArrayList<String>();

        var attachments = project.getAttachments() != null
                ? new ArrayList<>(project.getAttachments())
                : new ArrayList<String>();

        return new ProjectDTO(
                project.getId(),
                project.getProjectKey(),
                project.getSummary(),
                project.getDescription(),
                updatedTaskDTOs,
                members,
                attachments,
                convertUserToDTO(project.getOwner()),
                dependencyKeys
        );
    }

    private UserDTO convertUserToDTO(User user) {
        return new UserDTO(
                user.getId(),
                user.getFirstname(),
                user.getLastname(),
                user.getEmail(),
                user.getProfilePicture()
        );
    }
}