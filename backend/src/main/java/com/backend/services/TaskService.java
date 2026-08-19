package com.backend.services;

import com.backend.dtos.TaskDTO;
import com.backend.entities.NotificationType;
import com.backend.entities.Project;
import com.backend.entities.Task;
import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;
import com.backend.entities.User;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.mapper.EntityMapper;
import com.backend.repositories.ProjectRepository;
import com.backend.repositories.TaskKey;
import com.backend.repositories.TaskRepository;
import com.backend.requests.TaskRequest;
import com.backend.requests.TaskScheduleRequest;
import com.backend.scheduling.SchedulingService;
import com.backend.security.AccessGuard;
import com.backend.util.AfterCommit;
import com.backend.util.GraphCycles;
import com.backend.util.HtmlSanitizer;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class TaskService {
    private final TaskRepository taskRepository;
    private final ProjectRepository projectRepository;
    private final FileStorageService fileStorageService;
    private final UserService userService;
    private final TaskActivityService taskActivityService;
    private final NotificationService notificationService;
    private final EntityMapper entityMapper;
    private final AccessGuard accessGuard;
    private final SchedulingService schedulingService;

    public TaskService(TaskRepository taskRepository,
                       ProjectRepository projectRepository,
                       FileStorageService fileStorageService,
                       UserService userService,
                       TaskActivityService taskActivityService,
                       NotificationService notificationService,
                       EntityMapper entityMapper,
                       AccessGuard accessGuard,
                       SchedulingService schedulingService) {
        this.taskRepository = taskRepository;
        this.projectRepository = projectRepository;
        this.fileStorageService = fileStorageService;
        this.userService = userService;
        this.taskActivityService = taskActivityService;
        this.notificationService = notificationService;
        this.entityMapper = entityMapper;
        this.accessGuard = accessGuard;
        this.schedulingService = schedulingService;
    }

    @Transactional(rollbackFor = Exception.class)
    public TaskDTO createTask(String projectKey, TaskRequest request, Integer userId,
                              List<MultipartFile> files) {
        var project = projectRepository.findByProjectKeyWithLock(projectKey)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        accessGuard.requireAccess(project, userId);

        var author = userService.getRequiredUserById(userId);

        var task = new Task();
        task.setProject(project);
        task.setTaskNumber(project.allocateNextTaskNumber());
        task.setSummary(request.summary());
        task.setDescription(HtmlSanitizer.sanitizeRichText(request.description()));
        task.setStatus(Objects.requireNonNullElse(request.status(), TaskStatus.BACKLOG));
        task.setPriority(Objects.requireNonNullElse(request.priority(), TaskPriority.MEDIUM));
        task.setProgress(Objects.requireNonNullElse(request.progress(), 0));
        task.setStartDate(request.startDate());
        task.setDueDate(request.dueDate());
        task.setLabels(EntityMapper.joinLabels(request.labels()));
        task.setAssignee(resolveAssignee(request.assignee(), project));

        var declaredAttachments = nullSafe(request.attachments());

        if (!nullSafe(request.dependencyKeys()).isEmpty()) {
            task.replaceDependencies(resolveDependencies(request.dependencyKeys(), userId));
        }

        var attachments = fileStorageService.resolveAttachments(
                project.getId(), declaredAttachments, files, userId);
        task.replaceAttachments(attachments);

        var savedTask = taskRepository.save(task);
        taskActivityService.logCreated(savedTask, author);
        notifyAssignee(savedTask, userId, "You have been assigned to task: " + savedTask.getSummary(),
                NotificationType.TASK_ASSIGNED);

        return toDtoWithCriticality(savedTask);
    }

    @Transactional(rollbackFor = Exception.class)
    public TaskDTO updateTask(String projectKey, String taskKey, TaskRequest request,
                              Integer userId, List<MultipartFile> files) {
        var project = accessGuard.getAccessibleProject(projectKey, userId);
        var task = requireTaskInProject(taskKey, project);
        var author = userService.getRequiredUserById(userId);

        var before = TaskSnapshot.of(task);
        var previousAttachments = List.copyOf(task.getAttachments());

        task.setSummary(request.summary());
        task.setDescription(HtmlSanitizer.sanitizeRichText(request.description()));
        task.setStatus(Objects.requireNonNullElse(request.status(), TaskStatus.BACKLOG));
        task.setPriority(Objects.requireNonNullElse(request.priority(), TaskPriority.MEDIUM));
        task.setProgress(Objects.requireNonNullElse(request.progress(), 0));
        task.setStartDate(request.startDate());
        task.setDueDate(request.dueDate());
        task.setLabels(EntityMapper.joinLabels(request.labels()));
        task.setAssignee(resolveAssignee(request.assignee(), project));

        var declaredAttachments = nullSafe(request.attachments());

        var dependencies = resolveDependencies(request.dependencyKeys(), userId);
        validateNoCycles(task, dependencies);
        task.replaceDependencies(dependencies);

        var attachments = fileStorageService.resolveAttachments(
                project.getId(), declaredAttachments, files, userId);
        task.replaceAttachments(attachments);

        var updatedTask = taskRepository.save(task);
        taskActivityService.logFieldChanges(updatedTask, author, before, TaskSnapshot.of(updatedTask));
        fileStorageService.deleteRemovedAfterCommit(previousAttachments, attachments,
                "delete detached task attachments");
        notifyAssignee(updatedTask, userId,
                "Task '" + updatedTask.getSummary() + "' has been updated", NotificationType.TASK_UPDATED);

        return toDtoWithCriticality(updatedTask);
    }

    @Transactional(rollbackFor = Exception.class)
    public TaskDTO updateSchedule(String projectKey, String taskKey, TaskScheduleRequest request,
                                  Integer userId) {
        var project = accessGuard.getAccessibleProject(projectKey, userId);
        var task = requireTaskInProject(taskKey, project);
        var author = userService.getRequiredUserById(userId);

        var before = TaskSnapshot.of(task);
        task.setStartDate(request.startDate());
        task.setDueDate(request.dueDate());

        var updatedTask = taskRepository.save(task);
        taskActivityService.logFieldChanges(updatedTask, author, before, TaskSnapshot.of(updatedTask));
        notifyAssignee(updatedTask, userId,
                "Dates changed for task: " + updatedTask.getSummary(), NotificationType.TASK_UPDATED);

        return toDtoWithCriticality(updatedTask);
    }

    public record ScheduleChange(String taskKey, LocalDate startDate, LocalDate dueDate) {}

    @Transactional(rollbackFor = Exception.class)
    public int applySchedule(List<ScheduleChange> changes, Integer userId) {
        if (changes == null || changes.isEmpty()) {
            return 0;
        }
        var author = userService.getRequiredUserById(userId);
        var tasksByKey = loadTasksByKey(changes.stream().map(ScheduleChange::taskKey).toList());

        var pending = new ArrayList<NotificationService.Pending>();
        int applied = 0;

        for (var change : changes) {
            var task = tasksByKey.get(change.taskKey());
            if (task == null) {
                throw new ResourceNotFoundException("Task not found: " + change.taskKey());
            }
            accessGuard.requireAccess(task.getProject(), userId);
            if (change.startDate() == null || change.dueDate() == null
                    || change.dueDate().isBefore(change.startDate())) {
                throw new ValidationException("Invalid schedule for task: " + change.taskKey());
            }
            if (Objects.equals(task.getStartDate(), change.startDate())
                    && Objects.equals(task.getDueDate(), change.dueDate())) {
                continue;
            }

            var before = TaskSnapshot.of(task);
            task.setStartDate(change.startDate());
            task.setDueDate(change.dueDate());
            taskActivityService.logFieldChanges(task, author, before, TaskSnapshot.of(task));
            applied++;

            var assignee = task.getAssignee();
            if (assignee != null && !assignee.getId().equals(userId)) {
                pending.add(new NotificationService.Pending(assignee,
                        "Your task dates were updated by schedule optimization",
                        NotificationType.TASK_UPDATED,
                        NotificationService.taskLink(task.getTaskKey())));
            }
        }

        notificationService.notifyAll(pending);
        return applied;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteTask(String projectKey, String taskKey, Integer userId) {
        var project = accessGuard.getOwnedProject(projectKey, userId);
        var task = requireTaskInProject(taskKey, project);

        var assignee = task.getAssignee();
        if (assignee != null && !assignee.getId().equals(userId)) {
            notificationService.createNotification(assignee,
                    "Task '" + task.getSummary() + "' has been deleted",
                    NotificationType.TASK_DELETED, null);
        }

        var attachments = new ArrayList<>(task.getAttachments());
        for (var comment : task.getComments()) {
            attachments.addAll(comment.getAttachments());
        }
        taskRepository.delete(task);
        AfterCommit.run("delete attachments of " + taskKey,
                () -> fileStorageService.deleteFilesSilently(attachments));
    }

    private Task requireTaskInProject(String taskKey, Project project) {
        var task = taskRepository.findByTaskKey(taskKey)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found: " + taskKey));
        accessGuard.verifyTaskInProject(task, project);
        return task;
    }

    private User resolveAssignee(String email, Project project) {
        if (email == null || email.isBlank()) {
            return null;
        }
        var assignee = userService.findUserByEmailOrNull(email);
        if (assignee == null || !project.hasAccess(assignee.getId())) {
            throw new ValidationException("Assignee must be a member of this project");
        }
        return assignee;
    }

    private List<Task> resolveDependencies(List<String> dependencyKeys, Integer userId) {
        var keys = nullSafe(dependencyKeys).stream().filter(Objects::nonNull).distinct().toList();
        if (keys.isEmpty()) {
            return List.of();
        }

        var resolved = findTasksByKeys(keys);
        if (resolved.size() != keys.size()) {
            throw new ValidationException("One or more dependency tasks do not exist");
        }
        for (var dependency : resolved) {
            if (!dependency.getProject().hasAccess(userId)) {
                throw new ValidationException("One or more dependency tasks do not exist");
            }
        }
        return resolved;
    }

    private void validateNoCycles(Task task, List<Task> newDependencies) {
        if (task.getId() == null || newDependencies.isEmpty()) {
            return;
        }
        if (GraphCycles.createsCycle(task.getId(), newDependencies, Task::getId, Task::getDependencies)) {
            throw new ValidationException("Circular dependency detected: a task cannot depend on itself");
        }
    }

    private Map<String, Task> loadTasksByKey(List<String> taskKeys) {
        var result = new LinkedHashMap<String, Task>();
        for (var task : findTasksByKeys(taskKeys)) {
            result.put(task.getTaskKey(), task);
        }
        return result;
    }

    private List<Task> findTasksByKeys(List<String> taskKeys) {
        var byProject = new LinkedHashMap<String, List<Integer>>();
        for (var key : taskKeys) {
            var parsed = TaskKey.parse(key)
                    .orElseThrow(() -> new ValidationException("Invalid task key: " + key));
            byProject.computeIfAbsent(parsed.projectKey(), k -> new ArrayList<>()).add(parsed.taskNumber());
        }
        var tasks = new ArrayList<Task>();
        for (var entry : byProject.entrySet()) {
            tasks.addAll(taskRepository.findByProjectKeyAndTaskNumbers(entry.getKey(), entry.getValue()));
        }
        return tasks;
    }

    private void notifyAssignee(Task task, Integer actorId, String message, NotificationType type) {
        var assignee = task.getAssignee();
        if (assignee == null || assignee.getId().equals(actorId)) {
            return;
        }
        notificationService.createNotification(assignee, message, type,
                NotificationService.taskLink(task.getTaskKey()));
    }

    private TaskDTO toDtoWithCriticality(Task task) {
        var projectTasks = taskRepository.findByProjectIdWithDetails(task.getProject().getId()).stream()
                .map(t -> entityMapper.toTaskDTO(t, null))
                .toList();
        var analysis = schedulingService.analyzeCriticalPath(projectTasks, LocalDate.now());
        return schedulingService.applyCriticality(entityMapper.toTaskDTO(task, null), analysis);
    }

    private static <T> List<T> nullSafe(List<T> list) {
        return list == null ? List.of() : list;
    }
}
