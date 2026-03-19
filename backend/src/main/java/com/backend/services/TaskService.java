package com.backend.services;

import com.backend.dtos.TaskDTO;
import com.backend.entities.*;
import com.backend.exception.AuthorizationException;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.repositories.ProjectRepository;
import com.backend.repositories.TaskRepository;
import com.backend.repositories.UserRepository;
import com.backend.util.ValidationUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;

@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private final ProjectRepository projectRepository;
    private final FileStorageService fileStorageService;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public TaskService(TaskRepository taskRepository, ProjectRepository projectRepository,
                       FileStorageService fileStorageService, UserRepository userRepository,
                       NotificationService notificationService) {
        this.taskRepository = taskRepository;
        this.projectRepository = projectRepository;
        this.fileStorageService = fileStorageService;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public TaskDTO createTask(String projectKey, TaskDTO taskDTO, Integer userId, List<MultipartFile> files) {
        validateTaskDTO(taskDTO);

        var attachmentUrls = (files != null && !files.isEmpty())
                ? fileStorageService.storeFiles(files)
                : new ArrayList<String>();

        var project = projectRepository.findByProjectKeyWithLock(projectKey)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.hasAccess(userId)) {
            throw new ResourceNotFoundException("Project not found");
        }

        var task = new Task();
        task.setSummary(taskDTO.summary());
        task.setDescription(taskDTO.description());
        task.setStatus(Objects.requireNonNullElse(taskDTO.status(), TaskStatus.BACKLOG));
        task.setStartDate(taskDTO.startDate());
        task.setDueDate(taskDTO.dueDate());
        task.setPriority(Objects.requireNonNullElse(taskDTO.priority(), TaskPriority.MEDIUM));
        task.setProgress(Objects.requireNonNullElse(taskDTO.progress(), 0));
        task.setProject(project);
        task.setTaskNumber(project.allocateNextTaskNumber());
        task.setAttachments(attachmentUrls);

        if (taskDTO.assignee() != null && !taskDTO.assignee().isEmpty()) {
            var assignee = userRepository.findByEmail(taskDTO.assignee())
                    .orElseThrow(() -> new ValidationException("Assignee not found"));
            task.setAssignee(assignee);
        }

        if (taskDTO.labels() != null && !taskDTO.labels().isEmpty()) {
            task.setLabels(String.join(",", taskDTO.labels()));
        }

        projectRepository.save(project);

        if (taskDTO.dependencyKeys() != null && !taskDTO.dependencyKeys().isEmpty()) {
            task.setDependencies(resolveDependenciesBatch(taskDTO.dependencyKeys()));
        }

        var savedTask = taskRepository.save(task);

        if (task.getAssignee() != null && !task.getAssignee().getId().equals(userId)) {
            var message = "You have been assigned to task: " + task.getSummary();
            var link = "/projects?selectedIssue=" + savedTask.getTaskKey();
            notificationService.createNotification(task.getAssignee(), message,
                    NotificationType.TASK_ASSIGNED, link);
        }

        return convertToDTO(savedTask);
    }

    @Transactional
    public TaskDTO updateTask(String projectKey, String taskKey, TaskDTO taskDTO,
                              Integer userId, List<MultipartFile> files) {
        validateTaskDTO(taskDTO);

        var project = projectRepository.findByProjectKey(projectKey)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.hasAccess(userId)) {
            throw new ResourceNotFoundException("Project not found");
        }

        var task = taskRepository.findByTaskKey(taskKey)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found: " + taskKey));

        if (!task.getProject().getId().equals(project.getId())) {
            throw new ValidationException("Task does not belong to the specified project");
        }

        task.setSummary(taskDTO.summary());
        task.setDescription(taskDTO.description());
        task.setStatus(Objects.requireNonNullElse(taskDTO.status(), TaskStatus.BACKLOG));
        task.setStartDate(taskDTO.startDate());
        task.setDueDate(taskDTO.dueDate());
        task.setProgress(Objects.requireNonNullElse(taskDTO.progress(), 0));
        task.setPriority(Objects.requireNonNullElse(taskDTO.priority(), TaskPriority.MEDIUM));

        if (taskDTO.assignee() != null && !taskDTO.assignee().isEmpty()) {
            var assignee = userRepository.findByEmail(taskDTO.assignee())
                    .orElseThrow(() -> new ValidationException("Assignee not found"));
            task.setAssignee(assignee);
        } else {
            task.setAssignee(null);
        }

        if (taskDTO.labels() != null) {
            task.setLabels(String.join(",", taskDTO.labels()));
        }

        task.setAttachments(taskDTO.attachments() != null
                ? new ArrayList<>(taskDTO.attachments())
                : new ArrayList<>());

        if (files != null && !files.isEmpty()) {
            var newAttachments = fileStorageService.storeFiles(files);
            task.getAttachments().addAll(newAttachments);
        }

        updateTaskDependencies(task, taskDTO.dependencyKeys());

        var updatedTask = taskRepository.save(task);

        if (task.getAssignee() != null && !task.getAssignee().getId().equals(userId)) {
            var message = "Task '" + task.getSummary() + "' has been updated";
            var link = "/projects?selectedIssue=" + updatedTask.getTaskKey();
            notificationService.createNotification(task.getAssignee(), message,
                    NotificationType.TASK_UPDATED, link);
        }

        return convertToDTO(updatedTask);
    }

    public void validateTaskDTO(TaskDTO taskDTO) {
        if (ValidationUtil.isNullOrEmpty(taskDTO.summary())) {
            throw new ValidationException("Summary is required");
        }
        if (taskDTO.summary().length() > ValidationUtil.MAX_SUMMARY_LENGTH) {
            throw new ValidationException("Summary exceeds maximum length of " + ValidationUtil.MAX_SUMMARY_LENGTH + " characters");
        }
        if (taskDTO.description() != null && taskDTO.description().length() > ValidationUtil.MAX_DESCRIPTION_LENGTH) {
            throw new ValidationException("Description exceeds maximum length of " + ValidationUtil.MAX_DESCRIPTION_LENGTH + " characters");
        }
        if (taskDTO.progress() != null && (taskDTO.progress() < 0 || taskDTO.progress() > 100)) {
            throw new ValidationException("Progress must be between 0 and 100");
        }
        if (taskDTO.labels() != null) {
            for (String label : taskDTO.labels()) {
                if (label != null && label.contains(",")) {
                    throw new ValidationException("Labels cannot contain commas");
                }
            }
        }
    }

    public TaskDTO convertToDTO(Task task) {
        var dependencyKeys = extractDependencyKeys(task);
        var labels = parseLabels(task.getLabels());
        var assigneeEmail = task.getAssignee() != null ? task.getAssignee().getEmail() : null;
        var attachments = task.getAttachments() != null
                ? new ArrayList<>(task.getAttachments())
                : new ArrayList<String>();

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

    private List<String> extractDependencyKeys(Task task) {
        if (task.getDependencies() == null || task.getDependencies().isEmpty()) {
            return null;
        }
        return task.getDependencies().stream()
                .map(Task::getTaskKey)
                .toList();
    }

    private List<String> parseLabels(String labelsString) {
        if (labelsString == null || labelsString.isEmpty()) {
            return null;
        }
        return Arrays.asList(labelsString.split(","));
    }

    private void updateTaskDependencies(Task task, List<String> dependencyKeys) {
        if (dependencyKeys != null) {
            var dependencies = resolveDependenciesBatch(dependencyKeys);
            validateNoCycles(task, dependencies);
            task.setDependencies(dependencies);
        } else {
            task.setDependencies(new ArrayList<>());
        }
    }

    private List<Task> resolveDependenciesBatch(List<String> dependencyRefs) {
        if (dependencyRefs == null || dependencyRefs.isEmpty()) {
            return new ArrayList<>();
        }

        var tasksByProjectKey = new HashMap<String, List<Integer>>();
        for (var ref : dependencyRefs) {
            if (ref == null || !ref.contains("-")) continue;
            var lastDash = ref.lastIndexOf('-');
            var projectKey = ref.substring(0, lastDash);
            try {
                var taskNumber = Integer.parseInt(ref.substring(lastDash + 1));
                tasksByProjectKey.computeIfAbsent(projectKey, k -> new ArrayList<>()).add(taskNumber);
            } catch (NumberFormatException ignored) {
            }
        }

        var dependencies = new ArrayList<Task>();
        for (var entry : tasksByProjectKey.entrySet()) {
            dependencies.addAll(taskRepository.findByProjectKeyAndTaskNumbers(entry.getKey(), entry.getValue()));
        }
        return dependencies;
    }

    private void validateNoCycles(Task task, List<Task> newDependencies) {
        if (task.getId() == null || newDependencies.isEmpty()) {
            return;
        }

        var visitedTaskIds = new HashSet<Integer>();
        var tasksToCheck = new LinkedList<>(newDependencies);

        while (!tasksToCheck.isEmpty()) {
            var current = tasksToCheck.poll();
            if (current.getId().equals(task.getId())) {
                throw new ValidationException("Circular dependency detected: task cannot depend on itself");
            }
            if (visitedTaskIds.add(current.getId()) && current.getDependencies() != null) {
                tasksToCheck.addAll(current.getDependencies());
            }
        }
    }

    @Transactional
    public void deleteTask(String projectKey, String taskKey, Integer userId) {
        var project = projectRepository.findByProjectKey(projectKey)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.isOwner(userId)) {
            throw new AuthorizationException("Only project owner can delete tasks");
        }

        var task = taskRepository.findByTaskKey(taskKey)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found: " + taskKey));

        if (!task.getProject().getId().equals(project.getId())) {
            throw new ValidationException("Task does not belong to the specified project");
        }

        deleteTaskAttachmentsSilently(task);
        taskRepository.delete(task);
    }

    private void deleteTaskAttachmentsSilently(Task task) {
        if (task.getAttachments() == null) return;
        for (String attachment : task.getAttachments()) {
            try {
                fileStorageService.deleteFile(attachment);
            } catch (Exception e) {
                org.slf4j.LoggerFactory.getLogger(TaskService.class)
                        .warn("Failed to delete task attachment: {}", attachment, e);
            }
        }
    }
}
