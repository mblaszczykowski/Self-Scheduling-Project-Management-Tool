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

        User owner = userDAO.getUserById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        List<String> attachmentUrls = new ArrayList<>();
        if (attachments != null && !attachments.isEmpty()) {
            attachmentUrls = fileStorageService.storeFiles(attachments);
        }

        Project project = new Project();
        project.setProjectKey(projectDTO.projectKey());
        project.setSummary(projectDTO.summary());
        project.setDescription(projectDTO.description());
        project.setOwner(owner);
        project.setNextTaskNumber(1);
        project.setAttachments(attachmentUrls);

        Set<User> members = new HashSet<>();
        members.add(owner);

        // Frontend sends members array with email objects
        if (projectDTO.members() != null) {
            for (UserDTO memberDTO : projectDTO.members()) {
                if (!memberDTO.email().equals(owner.getEmail())) {
                    User member = userDAO.getUserByEmail(memberDTO.email())
                            .orElseThrow(() -> new ValidationException(
                                    "User with email " + memberDTO.email() + " does not exist"));
                    members.add(member);
                }
            }
        }
        project.setMembers(new ArrayList<>(members));

        if (projectDTO.dependencies() != null && !projectDTO.dependencies().isEmpty()) {
            List<Project> dependencies = projectDTO.dependencies().stream()
                    .map(depKey -> projectDAO.getProjectByKey(depKey)
                            .orElseThrow(() -> new ValidationException("Dependency project not found: " + depKey)))
                    .collect(Collectors.toList());
            project.setDependencies(dependencies);
        }

        Project savedProject = projectDAO.save(project);

        for (User member : members) {
            if (!member.getId().equals(owner.getId())) {
                String message = "You have been added to project: " + project.getSummary();
                String link = "/projects/" + project.getProjectKey();
                notificationService.createNotification(member, message,
                        NotificationType.PROJECT_INVITATION, link);
            }
        }

        return convertToDTO(savedProject);
    }

    @Transactional(readOnly = true)
    public ProjectDTO getProjectByKey(String projectKey, Integer userId) {
        Project project = projectDAO.getProjectByKey(projectKey)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.hasAccess(userId)) {
            throw new ResourceNotFoundException("Project not found");
        }

        return convertToDTOWithCPM(project);
    }

    @Transactional(readOnly = true)
    public List<ProjectDTO> getAllProjects(Integer userId) {
        List<Project> projects = projectDAO.getProjectsByUserId(userId);
        return projects.stream()
                .map(this::convertToDTOWithCPM)
                .collect(Collectors.toList());
    }

    @Transactional
    public ProjectDTO updateProject(ProjectDTO projectDTO, Integer userId, List<MultipartFile> attachments) {
        validateProjectDTO(projectDTO);

        Project project = projectDAO.getProjectByKey(projectDTO.projectKey())
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.isOwner(userId)) {
            throw new AuthorizationException("Only project owner can update the project");
        }

        project.setSummary(projectDTO.summary());
        project.setDescription(projectDTO.description());

        if (attachments != null && !attachments.isEmpty()) {
            List<String> newAttachments = fileStorageService.storeFiles(attachments);
            if (project.getAttachments() != null) {
                project.getAttachments().addAll(newAttachments);
            } else {
                project.setAttachments(newAttachments);
            }
        }

        List<User> oldMembers = new ArrayList<>(project.getMembers());

        // Handle members update - frontend sends members array
        if (projectDTO.members() != null) {
            Set<User> newMembers = new HashSet<>();
            User owner = project.getOwner();
            newMembers.add(owner);

            for (UserDTO memberDTO : projectDTO.members()) {
                if (!memberDTO.email().equals(owner.getEmail())) {
                    User member = userDAO.getUserByEmail(memberDTO.email())
                            .orElseThrow(() -> new ValidationException(
                                    "User with email " + memberDTO.email() + " does not exist"));
                    newMembers.add(member);
                }
            }
            project.setMembers(new ArrayList<>(newMembers));

            for (User member : newMembers) {
                if (!oldMembers.contains(member) && !member.getId().equals(owner.getId())) {
                    String message = "You have been added to project: " + project.getSummary();
                    String link = "/projects/" + project.getProjectKey();
                    notificationService.createNotification(member, message,
                            NotificationType.PROJECT_INVITATION, link);
                }
            }
        }

        if (projectDTO.dependencies() != null) {
            List<Project> dependencies = projectDTO.dependencies().stream()
                    .map(depKey -> projectDAO.getProjectByKey(depKey)
                            .orElseThrow(() -> new ValidationException("Dependency project not found: " + depKey)))
                    .collect(Collectors.toList());
            project.setDependencies(dependencies);
        }

        Project updatedProject = projectDAO.save(project);
        return convertToDTO(updatedProject);
    }

    @Transactional
    public void deleteProject(String projectKey, Integer userId) {
        Project project = projectDAO.getProjectByKey(projectKey)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.isOwner(userId)) {
            throw new AuthorizationException("Only project owner can delete the project");
        }

        projectDAO.deleteProject(project);
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
    }

    private ProjectDTO convertToDTO(Project project) {
        List<TaskDTO> tasks = project.getTasks() != null
                ? project.getTasks().stream()
                .map(taskService::convertToDTO)
                .collect(Collectors.toList())
                : new ArrayList<>();

        List<UserDTO> members = project.getMembers() != null
                ? project.getMembers().stream()
                .map(this::convertUserToDTO)
                .collect(Collectors.toList())
                : new ArrayList<>();

        UserDTO ownerDTO = convertUserToDTO(project.getOwner());

        List<String> dependencyKeys = project.getDependencies() != null
                ? project.getDependencies().stream()
                .map(Project::getProjectKey)
                .collect(Collectors.toList())
                : new ArrayList<>();

        List<String> attachments = project.getAttachments() != null
                ? new ArrayList<>(project.getAttachments())
                : new ArrayList<>();

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
        List<Task> tasks = taskDAO.getTasksByProjectIdWithDetails(project.getId());
        tasks.sort(Comparator.comparingInt(Task::getTaskNumber));

        List<TaskDTO> taskDTOs = tasks.stream()
                .map(taskService::convertToDTO)
                .collect(Collectors.toList());

        List<TaskDTO> updatedTaskDTOs = cpmHelper.calculateTaskDTOsWithCPM(taskDTOs);

        List<UserDTO> members = project.getMembers().stream()
                .map(this::convertUserToDTO)
                .collect(Collectors.toList());

        List<String> dependencyKeys = project.getDependencies() != null
                ? project.getDependencies().stream()
                .map(Project::getProjectKey)
                .collect(Collectors.toList())
                : new ArrayList<>();

        List<String> attachments = project.getAttachments() != null
                ? new ArrayList<>(project.getAttachments())
                : new ArrayList<>();

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