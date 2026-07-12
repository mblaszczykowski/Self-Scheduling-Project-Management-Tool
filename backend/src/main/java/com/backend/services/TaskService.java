package com.backend.services;

import com.backend.dtos.TaskDTO;
import com.backend.entities.*;
import com.backend.events.NotificationEvent;
import com.backend.exception.AuthorizationException;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.repositories.ProjectRepository;
import com.backend.repositories.TaskRepository;
import com.backend.repositories.UserRepository;
import com.backend.requests.TaskCreateRequest;
import com.backend.util.AccessGuard;
import com.backend.util.EntityMapper;
import org.springframework.context.ApplicationEventPublisher;
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
    private final TaskActivityService taskActivityService;
    private final EntityMapper entityMapper;
    private final AccessGuard accessGuard;
    private final ApplicationEventPublisher applicationEventPublisher;

    public TaskService(TaskRepository taskRepository, ProjectRepository projectRepository,
                       FileStorageService fileStorageService, UserRepository userRepository,
                       TaskActivityService taskActivityService,
                       EntityMapper entityMapper, AccessGuard accessGuard,
                       ApplicationEventPublisher applicationEventPublisher) {
        this.taskRepository = taskRepository;
        this.projectRepository = projectRepository;
        this.fileStorageService = fileStorageService;
        this.userRepository = userRepository;
        this.taskActivityService = taskActivityService;
        this.entityMapper = entityMapper;
        this.accessGuard = accessGuard;
        this.applicationEventPublisher = applicationEventPublisher;
    }

    @Transactional(rollbackFor = Exception.class)
    public TaskDTO createTask(String projectKey, TaskCreateRequest request, Integer userId, List<MultipartFile> files) {
        validateLabels(request.labels());

        var project = projectRepository.findByProjectKeyWithLock(projectKey)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        accessGuard.requireAccess(project, userId);

        // Store files only after authorization: file storage is not transactional, so a
        // later rollback would not remove them (avoids orphaned writes by unauthorized callers).
        var attachmentUrls = (files != null && !files.isEmpty())
                ? fileStorageService.storeFiles(files)
                : new ArrayList<String>();

        var task = new Task();
        task.setSummary(request.summary());
        task.setDescription(request.description());
        task.setStatus(Objects.requireNonNullElse(request.status(), TaskStatus.BACKLOG));
        task.setStartDate(request.startDate());
        task.setDueDate(request.dueDate());
        task.setPriority(Objects.requireNonNullElse(request.priority(), TaskPriority.MEDIUM));
        task.setProgress(Objects.requireNonNullElse(request.progress(), 0));
        task.setProject(project);
        task.setTaskNumber(project.allocateNextTaskNumber());
        task.replaceAttachments(attachmentUrls);

        if (request.assignee() != null && !request.assignee().isEmpty()) {
            var assignee = userRepository.findByEmail(request.assignee())
                    .orElseThrow(() -> new ValidationException("Assignee not found"));
            task.setAssignee(assignee);
        }

        if (request.labels() != null && !request.labels().isEmpty()) {
            task.setLabels(String.join(",", request.labels()));
        }

        projectRepository.save(project);

        if (request.dependencyKeys() != null && !request.dependencyKeys().isEmpty()) {
            task.replaceDependencies(resolveDependenciesBatch(request.dependencyKeys(), userId));
        }

        var savedTask = taskRepository.save(task);

        var author = userRepository.findById(userId).orElse(null);
        if (author != null) {
            taskActivityService.logCreated(savedTask, author);
        }

        if (task.getAssignee() != null && !task.getAssignee().getId().equals(userId)) {
            var message = "You have been assigned to task: " + task.getSummary();
            var link = "/projects?selectedIssue=" + savedTask.getTaskKey();
            applicationEventPublisher.publishEvent(new NotificationEvent(task.getAssignee(), message,
                    NotificationType.TASK_ASSIGNED, link));
        }

        return convertToDTO(savedTask);
    }

    @Transactional(rollbackFor = Exception.class)
    public TaskDTO updateTask(String projectKey, String taskKey, TaskCreateRequest request,
                              Integer userId, List<MultipartFile> files) {
        validateLabels(request.labels());

        var project = accessGuard.getAccessibleProject(projectKey, userId);

        var task = taskRepository.findByTaskKey(taskKey)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found: " + taskKey));

        accessGuard.verifyTaskInProject(task, project);

        // Snapshot old values for activity logging
        var oldStatus = task.getStatus();
        var oldPriority = task.getPriority();
        var oldAssignee = task.getAssignee() != null ? task.getAssignee().getFullName() : null;
        var oldProgress = task.getProgress();
        var oldStartDate = task.getStartDate() != null ? task.getStartDate().toString() : null;
        var oldDueDate = task.getDueDate() != null ? task.getDueDate().toString() : null;
        var oldSummary = task.getSummary();
        var oldLabels = task.getLabels();
        var oldDeps = String.join(",", Objects.requireNonNullElse(EntityMapper.extractDependencyKeys(task), List.<String>of()));

        task.setSummary(request.summary());
        task.setDescription(request.description());
        task.setStatus(Objects.requireNonNullElse(request.status(), TaskStatus.BACKLOG));
        task.setStartDate(request.startDate());
        task.setDueDate(request.dueDate());
        task.setProgress(Objects.requireNonNullElse(request.progress(), 0));
        task.setPriority(Objects.requireNonNullElse(request.priority(), TaskPriority.MEDIUM));

        if (request.assignee() != null && !request.assignee().isEmpty()) {
            var assignee = userRepository.findByEmail(request.assignee())
                    .orElseThrow(() -> new ValidationException("Assignee not found"));
            task.setAssignee(assignee);
        } else {
            task.setAssignee(null);
        }

        if (request.labels() != null) {
            task.setLabels(String.join(",", request.labels()));
        }

        task.replaceAttachments(request.attachments() != null
                ? new ArrayList<>(request.attachments())
                : new ArrayList<>());

        if (files != null && !files.isEmpty()) {
            var newAttachments = fileStorageService.storeFiles(files);
            task.addAttachments(newAttachments);
        }

        updateTaskDependencies(task, request.dependencyKeys(), userId);

        var updatedTask = taskRepository.save(task);

        // Log activity
        var author = userRepository.findById(userId).orElse(null);
        if (author != null) {
            var newAssignee = task.getAssignee() != null ? task.getAssignee().getFullName() : null;
            var newStartDate = task.getStartDate() != null ? task.getStartDate().toString() : null;
            var newDueDate = task.getDueDate() != null ? task.getDueDate().toString() : null;
            var newDeps = String.join(",", Objects.requireNonNullElse(EntityMapper.extractDependencyKeys(task), List.<String>of()));
            taskActivityService.logFieldChanges(updatedTask, author,
                    oldStatus, task.getStatus(),
                    oldPriority, task.getPriority(),
                    oldAssignee, newAssignee,
                    oldProgress, task.getProgress(),
                    oldStartDate, newStartDate,
                    oldDueDate, newDueDate,
                    oldSummary, task.getSummary(),
                    oldLabels, task.getLabels(),
                    oldDeps, newDeps);
        }

        if (task.getAssignee() != null && !task.getAssignee().getId().equals(userId)) {
            var message = "Task '" + task.getSummary() + "' has been updated";
            var link = "/projects?selectedIssue=" + updatedTask.getTaskKey();
            applicationEventPublisher.publishEvent(new NotificationEvent(task.getAssignee(), message,
                    NotificationType.TASK_UPDATED, link));
        }

        return convertToDTO(updatedTask);
    }

    public TaskDTO convertToDTO(Task task) {
        return entityMapper.toTaskDTO(task);
    }

    private void validateLabels(List<String> labels) {
        if (labels != null) {
            for (String label : labels) {
                if (label != null && label.contains(",")) {
                    throw new ValidationException("Labels cannot contain commas");
                }
            }
        }
    }

    private void updateTaskDependencies(Task task, List<String> dependencyKeys, Integer userId) {
        if (dependencyKeys != null) {
            var dependencies = resolveDependenciesBatch(dependencyKeys, userId);
            validateNoCycles(task, dependencies);
            task.replaceDependencies(dependencies);
        } else {
            task.clearDependencies();
        }
    }

    private List<Task> resolveDependenciesBatch(List<String> dependencyRefs, Integer userId) {
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

        if (userId != null) {
            for (var dep : dependencies) {
                if (!dep.getProject().hasAccess(userId)) {
                    throw new AuthorizationException(
                            "Cannot create dependency to task in inaccessible project: " + dep.getTaskKey());
                }
            }
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

    @Transactional(rollbackFor = Exception.class)
    public void deleteTask(String projectKey, String taskKey, Integer userId) {
        var project = accessGuard.getOwnedProject(projectKey, userId);

        var task = taskRepository.findByTaskKey(taskKey)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found: " + taskKey));

        accessGuard.verifyTaskInProject(task, project);

        if (task.getAssignee() != null && !task.getAssignee().getId().equals(userId)) {
            var message = "Task '" + task.getSummary() + "' has been deleted";
            applicationEventPublisher.publishEvent(new NotificationEvent(task.getAssignee(), message,
                    NotificationType.TASK_DELETED, null));
        }

        deleteTaskAttachmentsSilently(task);
        taskRepository.delete(task);
    }

    private void deleteTaskAttachmentsSilently(Task task) {
        fileStorageService.deleteFilesSilently(task.getAttachments());
    }
}
