package com.backend.services;

import com.backend.daos.ProjectDAO;
import com.backend.daos.TaskDAO;
import com.backend.daos.UserDAO;
import com.backend.dtos.TaskDTO;
import com.backend.entities.*;
import com.backend.exception.AuthorizationException;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.util.ValidationUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class TaskService {

    private final TaskDAO taskDAO;
    private final ProjectDAO projectDAO;
    private final FileStorageService fileStorageService;
    private final UserDAO userDAO;
    private final NotificationService notificationService;

    public TaskService(TaskDAO taskDAO, ProjectDAO projectDAO, FileStorageService fileStorageService,
                       UserDAO userDAO, NotificationService notificationService) {
        this.taskDAO = taskDAO;
        this.projectDAO = projectDAO;
        this.fileStorageService = fileStorageService;
        this.userDAO = userDAO;
        this.notificationService = notificationService;
    }

    @Transactional
    public TaskDTO createTask(String projectKey, TaskDTO taskDTO, Integer userId, List<MultipartFile> files) {
        validateTaskDTO(taskDTO);

        List<String> attachmentUrls = new ArrayList<>();
        if (files != null && !files.isEmpty()) {
            attachmentUrls = fileStorageService.storeFiles(files);
        }

        Project project = projectDAO.getProjectByKeyWithLock(projectKey)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.hasAccess(userId)) {
            throw new ResourceNotFoundException("Project not found");
        }

        Task task = new Task();
        task.setSummary(taskDTO.summary());
        task.setDescription(taskDTO.description());
        task.setStatus(taskDTO.status() != null ? taskDTO.status() : TaskStatus.BACKLOG);
        task.setStartDate(taskDTO.startDate());
        task.setDueDate(taskDTO.dueDate());
        task.setPriority(taskDTO.priority() != null ? taskDTO.priority() : TaskPriority.MEDIUM);
        task.setProgress(taskDTO.progress() != null ? taskDTO.progress() : 0);
        task.setProject(project);
        task.setTaskNumber(project.allocateNextTaskNumber());
        task.setAttachments(attachmentUrls);

        if (taskDTO.assignee() != null && !taskDTO.assignee().isEmpty()) {
            User assignee = userDAO.getUserByEmail(taskDTO.assignee())
                    .orElseThrow(() -> new ValidationException("Assignee not found"));
            task.setAssignee(assignee);
        }

        if (taskDTO.labels() != null && !taskDTO.labels().isEmpty()) {
            task.setLabels(String.join(",", taskDTO.labels()));
        }

        // Handle dependencies - frontend sends task IDs as integers
        if (taskDTO.dependencyKeys() != null && !taskDTO.dependencyKeys().isEmpty()) {
            List<Task> dependencies = resolveDependencies(taskDTO.dependencyKeys());
            task.setDependencies(dependencies);
        }

        projectDAO.save(project);
        Task savedTask = taskDAO.save(task);

        if (task.getAssignee() != null && !task.getAssignee().getId().equals(userId)) {
            String message = "You have been assigned to task: " + task.getSummary();
            String link = "/projects?selectedIssue=" + savedTask.getTaskKey();
            notificationService.createNotification(task.getAssignee(), message,
                    NotificationType.TASK_ASSIGNED, link);
        }

        return convertToDTO(savedTask);
    }

    @Transactional
    public TaskDTO updateTask(String projectKey, String taskKey, TaskDTO taskDTO,
                              Integer userId, List<MultipartFile> files) {
        validateTaskDTO(taskDTO);

        Project project = projectDAO.getProjectByKey(projectKey)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.hasAccess(userId)) {
            throw new ResourceNotFoundException("Project not found");
        }

        Task task = taskDAO.getTaskByTaskKey(taskKey)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found: " + taskKey));

        if (!task.getProject().getId().equals(project.getId())) {
            throw new ValidationException("Task does not belong to the specified project");
        }

        task.setSummary(taskDTO.summary());
        task.setDescription(taskDTO.description());
        task.setStatus(taskDTO.status() != null ? taskDTO.status() : TaskStatus.BACKLOG);
        task.setStartDate(taskDTO.startDate());
        task.setDueDate(taskDTO.dueDate());
        task.setProgress(taskDTO.progress() != null ? taskDTO.progress() : 0);
        task.setPriority(taskDTO.priority() != null ? taskDTO.priority() : TaskPriority.MEDIUM);

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

        if (taskDTO.attachments() != null) {
            task.setAttachments(new ArrayList<>(taskDTO.attachments()));
        } else {
            task.setAttachments(new ArrayList<>());
        }

        if (files != null && !files.isEmpty()) {
            List<String> newAttachments = fileStorageService.storeFiles(files);
            task.getAttachments().addAll(newAttachments);
        }

        // Handle dependencies - can be task IDs (integers) or task keys (strings)
        if (taskDTO.dependencyKeys() != null) {
            List<Task> dependencies = resolveDependencies(taskDTO.dependencyKeys());
            task.setDependencies(dependencies);
        } else {
            task.setDependencies(new ArrayList<>());
        }

        Task updatedTask = taskDAO.save(task);

        if (task.getAssignee() != null && !task.getAssignee().getId().equals(userId)) {
            String message = "Task '" + task.getSummary() + "' has been updated";
            String link = "/projects?selectedIssue=" + updatedTask.getTaskKey();
            notificationService.createNotification(task.getAssignee(), message,
                    NotificationType.TASK_UPDATED, link);
        }

        return convertToDTO(updatedTask);
    }

    @Transactional
    public void deleteTask(String projectKey, String taskKey, Integer userId) {
        Project project = projectDAO.getProjectByKey(projectKey)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.isOwner(userId)) {
            throw new AuthorizationException("Only project owner can delete tasks");
        }

        Task task = taskDAO.getTaskByTaskKey(taskKey)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found: " + taskKey));

        if (!task.getProject().getId().equals(project.getId())) {
            throw new ValidationException("Task does not belong to the specified project");
        }

        taskDAO.deleteTask(task);
    }

    @Transactional(readOnly = true)
    public List<TaskDTO> getTasksAssignedToUser(Integer userId) {
        List<Task> tasks = taskDAO.getTasksAssignedToUser(userId);
        return tasks.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public void validateTaskDTO(TaskDTO taskDTO) {
        if (ValidationUtil.isNullOrEmpty(taskDTO.summary())) {
            throw new ValidationException("Summary is required");
        }
        if (taskDTO.status() == null) {
            throw new ValidationException("Status is required");
        }
    }

    public TaskDTO convertToDTO(Task task) {
        // Return dependency IDs as strings (task IDs)
        List<String> dependencyKeys = null;
        if (task.getDependencies() != null && !task.getDependencies().isEmpty()) {
            dependencyKeys = task.getDependencies().stream()
                    .map(t -> String.valueOf(t.getId()))
                    .collect(Collectors.toList());
        }

        List<String> labels = null;
        if (task.getLabels() != null && !task.getLabels().isEmpty()) {
            labels = Arrays.asList(task.getLabels().split(","));
        }

        String assigneeEmail = task.getAssignee() != null ? task.getAssignee().getEmail() : null;

        List<String> attachments = task.getAttachments() != null
                ? new ArrayList<>(task.getAttachments())
                : new ArrayList<>();

        return new TaskDTO(
                task.getId(),
                task.getTaskNumber(),
                task.getTaskKey(),
                task.getProject().getProjectKey(),
                task.getSummary(),
                task.getDescription(),
                task.getStatus(),
                task.getStartDate(),
                task.getDueDate(),
                assigneeEmail,
                labels,
                dependencyKeys,
                null,
                attachments,
                task.getCreated(),
                task.getUpdated(),
                task.getProgress(),
                task.getPriority()
        );
    }

    /**
     * Resolves dependency references - accepts both task IDs (integers) and task keys (PROJECT-123)
     */
    private List<Task> resolveDependencies(List<String> dependencyRefs) {
        if (dependencyRefs == null || dependencyRefs.isEmpty()) {
            return new ArrayList<>();
        }

        List<Task> dependencies = new ArrayList<>();

        for (String ref : dependencyRefs) {
            if (ref == null) continue;

            // Try parsing as integer ID first
            try {
                Integer taskId = Integer.parseInt(ref);
                taskDAO.getTaskById(taskId).ifPresent(dependencies::add);
            } catch (NumberFormatException e) {
                // Not an integer, try as task key (PROJECT-123)
                if (ref.contains("-")) {
                    taskDAO.getTaskByTaskKey(ref).ifPresent(dependencies::add);
                }
            }
        }

        return dependencies;
    }
}