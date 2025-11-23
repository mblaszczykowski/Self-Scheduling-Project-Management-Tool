package com.backend.services;

import com.backend.daos.ProjectDAO;
import com.backend.daos.TaskDAO;
import com.backend.daos.UserDAO;
import com.backend.dtos.TaskDTO;
import com.backend.entities.NotificationType;
import com.backend.entities.Project;
import com.backend.entities.Task;
import com.backend.entities.User;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.util.ValidationUtil;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class TaskService {

    private final TaskDAO taskDAO;
    private final ProjectDAO projectDAO;
    private final FileStorageService fileStorageService;
    private final UserDAO userDAO;
    private final NotificationService notificationService;

    public TaskService(TaskDAO taskDAO, ProjectDAO projectDAO, FileStorageService fileStorageService, UserDAO userDAO, NotificationService notificationService) {
        this.taskDAO = taskDAO;
        this.projectDAO = projectDAO;
        this.fileStorageService = fileStorageService;
        this.userDAO = userDAO;
        this.notificationService = notificationService;
    }
    public TaskDTO createTask(String projectKey, TaskDTO taskDTO, Integer userId, List<MultipartFile> files) {
        validateTaskDTO(taskDTO);

        Project project = projectDAO.getProjectByKey(projectKey)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.getUser().getId().equals(userId)) {
            throw new ResourceNotFoundException("Project not found for this user");
        }

        Task task = new Task();
        task.setSummary(taskDTO.summary());
        task.setDescription(taskDTO.description());
        task.setStatus(taskDTO.status());
        task.setStartDate(taskDTO.startDate());
        task.setDueDate(taskDTO.dueDate());
        task.setPriority(taskDTO.priority());

        task.setProgress(taskDTO.progress() != null ? taskDTO.progress() : 0);

        task.setCreated(taskDTO.created() != null ? taskDTO.created() : new Date());
        task.setUpdated(taskDTO.updated() != null ? taskDTO.updated() : new Date());

        if (taskDTO.assignee() != null && !taskDTO.assignee().isEmpty()) {
            User assignee = userDAO.getUserByEmail(taskDTO.assignee())
                    .orElseThrow(() -> new ValidationException("Assignee not found"));
            task.setAssignee(assignee);
        }

        task.setProject(project);

        if (files != null && !files.isEmpty()) {
            List<String> attachmentUrls = fileStorageService.storeFiles(files);
            task.setAttachments(attachmentUrls);
        }

        if (taskDTO.dependencies() != null && !taskDTO.dependencies().isEmpty()) {
            List<Task> dependencies = taskDTO.dependencies().stream()
                    .map(depKey -> taskDAO.getTaskById(depKey)
                            .orElseThrow(() -> new ResourceNotFoundException("Dependency task not found: " + depKey)))
                    .collect(Collectors.toList());
            task.setDependencies(dependencies);
        }

        taskDAO.addTask(task);

        if (task.getAssignee() != null && !task.getAssignee().getId().equals(userId)) {
            String message = "You have been assigned to task: " + task.getSummary();
            String link = "/timeline?selectedIssue=" + task.getProject().getProjectKey() + "-" + task.getId();
            notificationService.createNotification(task.getAssignee(), message, NotificationType.TASK_ASSIGNED, link);
        }

        return convertToDTO(task);
    }

    public TaskDTO updateTask(String projectKey, String taskId, TaskDTO taskDTO, Integer userId, List<MultipartFile> files) {
        validateTaskDTO(taskDTO);

        Project project = projectDAO.getProjectByKey(projectKey)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.getUser().getId().equals(userId)) {
            throw new ResourceNotFoundException("Project not found for this user");
        }

        Task task = taskDAO.getTaskById(Integer.valueOf(taskId))
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        if (!task.getProject().getId().equals(project.getId())) {
            throw new ValidationException("Task does not belong to the specified project");
        }

        task.setSummary(taskDTO.summary());
        task.setDescription(taskDTO.description());
        task.setStatus(taskDTO.status());
        task.setStartDate(taskDTO.startDate());
        task.setDueDate(taskDTO.dueDate());

        task.setProgress(taskDTO.progress() != null ? taskDTO.progress() : 0);

        task.setUpdated(taskDTO.updated() != null ? taskDTO.updated() : new Date());

        if (taskDTO.assignee() != null && !taskDTO.assignee().isEmpty()) {
            User assignee = userDAO.getUserByEmail(taskDTO.assignee())
                    .orElseThrow(() -> new ValidationException("Assignee not found"));
            task.setAssignee(assignee);
        } else {
            task.setAssignee(null);
        }

        if (taskDTO.labels() != null) {
            task.setLabels(String.join(",", taskDTO.labels()));
        }

        task.setPriority(taskDTO.priority());

        if (taskDTO.attachments() != null) {
            task.setAttachments(new ArrayList<>(taskDTO.attachments()));
        } else {
            task.setAttachments(new ArrayList<>());
        }

        if (files != null && !files.isEmpty()) {
            List<String> newAttachments = fileStorageService.storeFiles(files);
            task.getAttachments().addAll(newAttachments);
        }

        if (taskDTO.dependencies() != null) {
            List<Task> dependencies = taskDTO.dependencies().stream()
                    .map(depKey -> taskDAO.getTaskById(depKey)
                            .orElseThrow(() -> new ResourceNotFoundException("Dependency task not found: " + depKey)))
                    .collect(Collectors.toList());
            task.setDependencies(dependencies);
        } else {
            task.setDependencies(null);
        }

        taskDAO.updateTask(task);

        if (task.getAssignee() != null && !task.getAssignee().getId().equals(userId)) {
            String message = "Task '" + task.getSummary() + "' has been updated";
            String link = "/timeline?selectedIssue=" + task.getProject().getProjectKey() + "-" + task.getId();
            notificationService.createNotification(task.getAssignee(), message, NotificationType.TASK_UPDATED, link);
        }

        return convertToDTO(task);
    }

    public void validateTaskDTO(TaskDTO taskDTO) {
        if (ValidationUtil.isNullOrEmpty(taskDTO.summary()) || ValidationUtil.isNullOrEmpty(taskDTO.status())) {
            throw new ValidationException("Summary, and status are required");
        }
    }

    public TaskDTO convertToDTO(Task task) {
        List<Integer> dependencies = null;
        if (task.getDependencies() != null) {
            dependencies = task.getDependencies().stream()
                    .map(Task::getId)
                    .collect(Collectors.toList());
        }
        String taskKey = task.getProject().getProjectKey() + "-" + task.getId();
        String assigneeEmail = (task.getAssignee() != null) ? task.getAssignee().getEmail() : null;
        List<String> labels = (task.getLabels() != null) ? Arrays.asList(task.getLabels().split(",")) : null;

        return new TaskDTO(
                task.getId(),
                taskKey,
                task.getProject().getProjectKey(),
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

    public void deleteTask(String projectKey, String taskId, Integer userId) {
        Project project = projectDAO.getProjectByKey(projectKey)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.getUser().getId().equals(userId)) {
            throw new ResourceNotFoundException("Project not found for this user");
        }

        Task task = taskDAO.getTaskById(Integer.valueOf(taskId))
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        if (!task.getProject().getId().equals(project.getId())) {
            throw new ValidationException("Task does not belong to the specified project");
        }

        taskDAO.deleteTask(task);
    }

    public List<TaskDTO> getTasksAssignedToUser(Integer userId) {
        List<Task> tasks = taskDAO.getTasksAssignedToUser(userId);
        return tasks.stream().map(this::convertToDTO).collect(Collectors.toList());
    }
}
