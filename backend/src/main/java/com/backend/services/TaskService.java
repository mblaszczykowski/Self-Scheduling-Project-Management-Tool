package com.backend.services;

import com.backend.dtos.TaskDTO;
import com.backend.entities.NotificationType;
import com.backend.entities.Project;
import com.backend.entities.Task;
import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;
import com.backend.entities.User;
import com.backend.exception.AuthorizationException;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

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

    // ======================== Create ========================

    @Transactional(rollbackFor = Exception.class)
    public TaskDTO createTask(String projectKey, TaskRequest request, Integer userId,
                              List<MultipartFile> files) {
        // Locking the project row serialises task-number allocation.
        var project = projectRepository.findByProjectKeyWithLock(projectKey)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        accessGuard.requireAccess(project, userId);

        var author = userService.getRequiredUserById(userId);

        // Store files only after authorization: file storage is not transactional, so a later
        // rollback would not remove them.
        var uploaded = fileStorageService.storeFiles(files, project.getId(), userId);

        var task = new Task();
        task.setProject(project);
        task.setTaskNumber(project.allocateNextTaskNumber());
        task.setSummary(request.summary());
        task.setDescription(request.description());
        task.setStatus(Objects.requireNonNullElse(request.status(), TaskStatus.BACKLOG));
        task.setPriority(Objects.requireNonNullElse(request.priority(), TaskPriority.MEDIUM));
        task.setProgress(Objects.requireNonNullElse(request.progress(), 0));
        task.setStartDate(request.startDate());
        task.setDueDate(request.dueDate());
        task.setLabels(joinLabels(request.labels()));
        task.setAssignee(resolveAssignee(request.assignee(), project));

        var declaredAttachments = nullSafe(request.attachments());
        fileStorageService.requireAttachmentsBelongTo(project.getId(), declaredAttachments);
        var attachments = new ArrayList<>(declaredAttachments);
        attachments.addAll(uploaded);
        task.replaceAttachments(attachments);

        if (!nullSafe(request.dependencyKeys()).isEmpty()) {
            task.replaceDependencies(resolveDependencies(request.dependencyKeys(), userId));
        }

        var savedTask = taskRepository.save(task);
        taskActivityService.logCreated(savedTask, author);
        notifyAssignee(savedTask, userId, "You have been assigned to task: " + savedTask.getSummary(),
                NotificationType.TASK_ASSIGNED);

        return toDtoWithCriticality(savedTask);
    }

    // ======================== Update ========================

    /**
     * Replaces the task with the submitted representation.
     *
     * <p>This is a full {@code PUT}: an absent collection or scalar is a request to clear it. That
     * is only safe because the one caller which could not send a complete body — the timeline drag —
     * now has {@link #updateSchedule} instead. Reusing this endpoint for a partial change is what
     * silently reset progress to 0, priority to MEDIUM, and dropped every attachment.
     */
    @Transactional(rollbackFor = Exception.class)
    public TaskDTO updateTask(String projectKey, String taskKey, TaskRequest request,
                              Integer userId, List<MultipartFile> files) {
        var project = accessGuard.getAccessibleProject(projectKey, userId);
        var task = requireTaskInProject(taskKey, project);
        var author = userService.getRequiredUserById(userId);

        var before = TaskSnapshot.of(task);
        var previousAttachments = List.copyOf(task.getAttachments());

        task.setSummary(request.summary());
        task.setDescription(request.description());
        task.setStatus(Objects.requireNonNullElse(request.status(), TaskStatus.BACKLOG));
        task.setPriority(Objects.requireNonNullElse(request.priority(), TaskPriority.MEDIUM));
        task.setProgress(Objects.requireNonNullElse(request.progress(), 0));
        task.setStartDate(request.startDate());
        task.setDueDate(request.dueDate());
        task.setLabels(joinLabels(request.labels()));
        task.setAssignee(resolveAssignee(request.assignee(), project));

        var declaredAttachments = nullSafe(request.attachments());
        fileStorageService.requireAttachmentsBelongTo(project.getId(), declaredAttachments);
        var attachments = new ArrayList<>(declaredAttachments);
        attachments.addAll(fileStorageService.storeFiles(files, project.getId(), userId));
        task.replaceAttachments(attachments);

        var dependencies = resolveDependencies(request.dependencyKeys(), userId);
        validateNoCycles(task, dependencies);
        task.replaceDependencies(dependencies);

        var updatedTask = taskRepository.save(task);
        taskActivityService.logFieldChanges(updatedTask, author, before, TaskSnapshot.of(updatedTask));
        fileStorageService.deleteRemovedAfterCommit(previousAttachments, attachments,
                "delete detached task attachments");
        notifyAssignee(updatedTask, userId,
                "Task '" + updatedTask.getSummary() + "' has been updated", NotificationType.TASK_UPDATED);

        return toDtoWithCriticality(updatedTask);
    }

    /**
     * Moves a task in time and changes nothing else.
     *
     * <p>Exists so that a timeline drag — which knows only the new dates — cannot express anything
     * beyond them.
     */
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

    /** One task's new dates, as produced by the optimizer. */
    public record ScheduleChange(String taskKey, LocalDate startDate, LocalDate dueDate) {}

    /**
     * Applies a batch of optimizer-derived date changes.
     *
     * <p>Routed through the same audit and notification path as a manual edit, so the activity feed
     * does not lie about how a task's dates got there — bulk-rescheduling used to leave no trace and
     * notify nobody. Assignees get one notification per task they own.
     *
     * @return how many tasks were actually changed
     */
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
            if (!task.getProject().hasAccess(userId)) {
                throw new AuthorizationException("No access to task: " + change.taskKey());
            }
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
                        "/projects?selectedIssue=" + task.getTaskKey()));
            }
        }

        // One notification per assignee, not one per task: a portfolio-wide reschedule would
        // otherwise flood everyone involved.
        notificationService.notifyAll(pending);
        return applied;
    }

    // ======================== Delete ========================

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

        var attachments = List.copyOf(task.getAttachments());
        taskRepository.delete(task);
        // Files come off disk only once the row is really gone.
        AfterCommit.run("delete attachments of " + taskKey,
                () -> fileStorageService.deleteFilesSilently(attachments));
    }

    // ======================== Internals ========================

    private Task requireTaskInProject(String taskKey, Project project) {
        var task = taskRepository.findByTaskKey(taskKey)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found: " + taskKey));
        accessGuard.verifyTaskInProject(task, project);
        return task;
    }

    /**
     * Resolves an assignee, requiring them to be part of the project.
     *
     * <p>Without the membership check the endpoint doubled as an authenticated "is this address
     * registered?" oracle, and let a caller fire a notification with arbitrary text at any user.
     * The error message is deliberately the same whether the address is unknown or simply not a
     * member.
     */
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

    /**
     * Resolves dependency task keys, rejecting anything the caller cannot see.
     *
     * <p>Unparseable and unknown keys are rejected rather than silently dropped: quietly ignoring
     * one means the client believes it saved a dependency that does not exist.
     */
    private List<Task> resolveDependencies(List<String> dependencyKeys, Integer userId) {
        var keys = nullSafe(dependencyKeys).stream().filter(Objects::nonNull).distinct().toList();
        if (keys.isEmpty()) {
            return List.of();
        }

        var byProject = new LinkedHashMap<String, List<Integer>>();
        for (var key : keys) {
            var parsed = TaskKey.parse(key)
                    .orElseThrow(() -> new ValidationException("Invalid task key: " + key));
            byProject.computeIfAbsent(parsed.projectKey(), k -> new ArrayList<>()).add(parsed.taskNumber());
        }

        var resolved = new ArrayList<Task>();
        for (var entry : byProject.entrySet()) {
            resolved.addAll(taskRepository.findByProjectKeyAndTaskNumbers(entry.getKey(), entry.getValue()));
        }
        if (resolved.size() != keys.size()) {
            throw new ValidationException("One or more dependency tasks do not exist");
        }
        for (var dependency : resolved) {
            if (!dependency.getProject().hasAccess(userId)) {
                throw new AuthorizationException(
                        "Cannot create dependency to task in inaccessible project: " + dependency.getTaskKey());
            }
        }
        return resolved;
    }

    private void validateNoCycles(Task task, List<Task> newDependencies) {
        if (task.getId() == null || newDependencies.isEmpty()) {
            return;
        }
        var visited = new HashSet<Integer>();
        var queue = new LinkedList<>(newDependencies);
        while (!queue.isEmpty()) {
            var current = queue.poll();
            if (current.getId().equals(task.getId())) {
                throw new ValidationException("Circular dependency detected: a task cannot depend on itself");
            }
            if (visited.add(current.getId())) {
                queue.addAll(current.getDependencies());
            }
        }
    }

    private Map<String, Task> loadTasksByKey(List<String> taskKeys) {
        var byProject = new LinkedHashMap<String, List<Integer>>();
        for (var key : taskKeys) {
            var parsed = TaskKey.parse(key)
                    .orElseThrow(() -> new ValidationException("Invalid task key: " + key));
            byProject.computeIfAbsent(parsed.projectKey(), k -> new ArrayList<>()).add(parsed.taskNumber());
        }
        var result = new LinkedHashMap<String, Task>();
        for (var entry : byProject.entrySet()) {
            for (var task : taskRepository.findByProjectKeyAndTaskNumbers(entry.getKey(), entry.getValue())) {
                result.put(task.getTaskKey(), task);
            }
        }
        return result;
    }

    private void notifyAssignee(Task task, Integer actorId, String message, NotificationType type) {
        var assignee = task.getAssignee();
        if (assignee == null || assignee.getId().equals(actorId)) {
            return;
        }
        notificationService.createNotification(assignee, message, type,
                "/projects?selectedIssue=" + task.getTaskKey());
    }

    /**
     * Maps a task with its critical-path flag filled in.
     *
     * <p>Create and update responses used to hard-code {@code isCritical = null} while reads
     * populated it, so a client that rendered the response of its own write lost the flag until the
     * next refetch.
     */
    private TaskDTO toDtoWithCriticality(Task task) {
        var projectTasks = taskRepository.findByProjectIdWithDetails(task.getProject().getId()).stream()
                .map(t -> entityMapper.toTaskDTO(t, null))
                .toList();
        var critical = schedulingService.criticalTaskKeys(projectTasks, LocalDate.now());
        return entityMapper.toTaskDTO(task, critical.contains(task.getTaskKey()));
    }

    private static String joinLabels(List<String> labels) {
        var cleaned = nullSafe(labels).stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(label -> !label.isEmpty())
                .toList();
        for (var label : cleaned) {
            if (label.contains(",")) {
                throw new ValidationException("Labels cannot contain commas");
            }
        }
        return cleaned.isEmpty() ? null : String.join(",", cleaned);
    }

    private static <T> List<T> nullSafe(List<T> list) {
        return list == null ? List.of() : list;
    }

}
