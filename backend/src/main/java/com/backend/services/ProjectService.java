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
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.util.ValidationUtil;
import org.springframework.stereotype.Service;
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

    public ProjectDTO createProject(ProjectDTO projectDTO, Integer userId, List<MultipartFile> attachments) {
        validateProjectDTO(projectDTO);
        User creator = userDAO.getUserById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Project project = new Project();
        project.setProjectKey(projectDTO.projectKey());
        project.setSummary(projectDTO.summary());
        project.setDescription(projectDTO.description());
        project.setUser(creator);
        if (attachments != null && !attachments.isEmpty()) {
            List<String> attachmentUrls = fileStorageService.storeFiles(attachments);
            project.setAttachments(attachmentUrls);
        }
        Set<User> users = new HashSet<>();
        users.add(creator);
        if (projectDTO.users() != null) {
            for (UserDTO userDTO : projectDTO.users()) {
                String email = userDTO.email();
                if (!email.equals(creator.getEmail())) {
                    User user = userDAO.getUserByEmail(email)
                            .orElseThrow(() -> new ValidationException("User with email " + email + " does not exist. Ask them to create an account first."));
                    users.add(user);
                }
            }
        }
        project.setUsers(new ArrayList<>(users));

        // Handle dependencies
        if (projectDTO.dependencies() != null && !projectDTO.dependencies().isEmpty()) {
            List<Project> dependencies = projectDTO.dependencies().stream()
                    .map(depKey -> projectDAO.getProjectByKey(depKey)
                            .orElseThrow(() -> new ValidationException("Dependency project not found: " + depKey)))
                    .collect(Collectors.toList());
            project.setDependencies(dependencies);
        }

        projectDAO.addProject(project);
        for (User user : users) {
            if (!user.getId().equals(creator.getId())) {
                String message = "You have been added to the project: " + project.getSummary();
                String link = "/projects/" + project.getProjectKey();
                notificationService.createNotification(user, message, NotificationType.PROJECT_INVITATION, link);
            }
        }
        return convertToDTO(project);
    }

    public ProjectDTO getProjectByKey(String projectKey, Integer userId) {
        Project project = projectDAO.getProjectByKey(projectKey)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        if (!project.getUser().getId().equals(userId)) {
            throw new ResourceNotFoundException("Project not found for this user");
        }
        return convertToDTOWithCPM(project);
    }

    public List<ProjectDTO> getAllProjects(Integer userId) {
        List<Project> projects = projectDAO.getProjectsByUserId(userId);
        return projects.stream()
                .map(this::convertToDTOWithCPM)
                .collect(Collectors.toList());
    }

    public ProjectDTO updateProject(ProjectDTO projectDTO, Integer userId, List<MultipartFile> attachments) {
        validateProjectDTO(projectDTO);
        Project project = projectDAO.getProjectByKey(projectDTO.projectKey())
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        if (!project.getUser().getId().equals(userId)) {
            throw new ResourceNotFoundException("Project not found for this user");
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
        List<User> oldUsers = new ArrayList<>(project.getUsers());
        if (projectDTO.users() != null) {
            Set<User> users = new HashSet<>();
            User currentUser = userDAO.getUserById(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("User not found"));
            users.add(currentUser);
            for (UserDTO userDTO : projectDTO.users()) {
                String email = userDTO.email();
                if (!email.equals(currentUser.getEmail())) {
                    User user = userDAO.getUserByEmail(email)
                            .orElseThrow(() -> new ValidationException("User with email " + email + " does not exist. Ask them to create an account first."));
                    users.add(user);
                }
            }
            project.setUsers(new ArrayList<>(users));
            for (User user : users) {
                if (!oldUsers.contains(user) && !user.getId().equals(currentUser.getId())) {
                    String message = "You have been added to the project: " + project.getSummary();
                    String link = "/projects/" + project.getProjectKey();
                    notificationService.createNotification(user, message, NotificationType.PROJECT_INVITATION, link);
                }
            }
        }

        // Update dependencies
        if (projectDTO.dependencies() != null) {
            List<Project> dependencies = projectDTO.dependencies().stream()
                    .map(depKey -> projectDAO.getProjectByKey(depKey)
                            .orElseThrow(() -> new ValidationException("Dependency project not found: " + depKey)))
                    .collect(Collectors.toList());
            project.setDependencies(dependencies);
        }

        projectDAO.updateProject(project);
        return convertToDTO(project);
    }

    public void deleteProject(String projectKey, Integer userId) {
        Project project = projectDAO.getProjectByKey(projectKey)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        if (!project.getUser().getId().equals(userId)) {
            throw new ResourceNotFoundException("Project not found for this user");
        }
        projectDAO.deleteProject(project);
    }

    private void validateProjectDTO(ProjectDTO projectDTO) {
        if (ValidationUtil.isNullOrEmpty(projectDTO.projectKey()) || ValidationUtil.isNullOrEmpty(projectDTO.summary())) {
            throw new ValidationException("Project key and summary are required");
        }
    }

    private ProjectDTO convertToDTO(Project project) {
        List<TaskDTO> tasks = project.getTasks() != null
                ? project.getTasks().stream().map(taskService::convertToDTO).collect(Collectors.toList())
                : null;
        List<UserDTO> users = project.getUsers() != null
                ? project.getUsers().stream()
                .map(u -> new UserDTO(u.getId(), u.getFirstname(), u.getLastname(), u.getEmail(), u.getProfilePicture()))
                .collect(Collectors.toList())
                : null;
        User owner = project.getUser();
        UserDTO ownerDTO = new UserDTO(owner.getId(), owner.getFirstname(), owner.getLastname(), owner.getEmail(), owner.getProfilePicture());
        List<String> dependencyKeys = project.getDependencies() != null
                ? project.getDependencies().stream()
                .map(Project::getProjectKey)
                .collect(Collectors.toList())
                : null;
        return new ProjectDTO(
                project.getId(),
                project.getProjectKey(),
                project.getSummary(),
                project.getDescription(),
                tasks,
                users,
                project.getAttachments(),
                ownerDTO,
                dependencyKeys // Include dependencies
        );
    }

    private ProjectDTO convertToDTOWithCPM(Project project) {
        List<Task> tasks = taskDAO.getTasksByProjectId(project.getId());
        tasks.sort(Comparator.comparingInt(Task::getId));
        List<TaskDTO> taskDTOs = tasks.stream().map(this::mapToTaskDTO).collect(Collectors.toList());
        List<TaskDTO> updatedTaskDTOs = cpmHelper.calculateTaskDTOsWithCPM(taskDTOs);
        List<String> dependencyKeys = project.getDependencies() != null
                ? project.getDependencies().stream()
                .map(Project::getProjectKey)
                .collect(Collectors.toList())
                : null;
        return new ProjectDTO(
                project.getId(),
                project.getProjectKey(),
                project.getSummary(),
                project.getDescription(),
                updatedTaskDTOs,
                project.getUsers().stream()
                        .map(u -> new UserDTO(u.getId(), u.getFirstname(), u.getLastname(), u.getEmail(), u.getProfilePicture()))
                        .collect(Collectors.toList()),
                project.getAttachments(),
                new UserDTO(project.getUser().getId(), project.getUser().getFirstname(), project.getUser().getLastname(), project.getUser().getEmail(), project.getUser().getProfilePicture()),
                dependencyKeys
        );
    }

    private TaskDTO mapToTaskDTO(Task task) {
        List<Integer> dependencies = task.getDependencies() != null
                ? task.getDependencies().stream().map(Task::getId).collect(Collectors.toList())
                : new ArrayList<>();
        String assigneeEmail = task.getAssignee() != null ? task.getAssignee().getEmail() : null;
        var labels = (task.getLabels() != null) ? Arrays.asList(task.getLabels().split(",")) : null;

        return new TaskDTO(
                task.getId(),
                task.getProject().getProjectKey(),
                task.getProject().getProjectKey() + "-" + task.getId(),
                task.getSummary(),
                task.getDescription(),
                task.getStatus(),
                task.getStartDate(),
                task.getDueDate(),
                assigneeEmail,
                labels,
                dependencies,
                null,
                task.getAttachments(),
                task.getCreated(),
                task.getUpdated(),
                task.getProgress(),
                task.getPriority()
        );
    }
}
