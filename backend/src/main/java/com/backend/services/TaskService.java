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

import java.util.*;
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

        var attachmentUrls = (files != null && !files.isEmpty())
                ? fileStorageService.storeFiles(files)
                : new ArrayList<String>();

        var project = projectDAO.getProjectByKeyWithLock(projectKey)
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
            var assignee = userDAO.getUserByEmail(taskDTO.assignee())
                    .orElseThrow(() -> new ValidationException("Assignee not found"));
            task.setAssignee(assignee);
        }

        if (taskDTO.labels() != null && !taskDTO.labels().isEmpty()) {
            task.setLabels(String.join(",", taskDTO.labels()));
        }

        persistProjectWithIncrementedTaskCounter(project);

        if (taskDTO.dependencyKeys() != null && !taskDTO.dependencyKeys().isEmpty()) {
            task.setDependencies(resolveDependenciesBatch(taskDTO.dependencyKeys()));
        }

        var savedTask = taskDAO.save(task);

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

        var project = projectDAO.getProjectByKey(projectKey)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.hasAccess(userId)) {
            throw new ResourceNotFoundException("Project not found");
        }

        var task = taskDAO.getTaskByTaskKey(taskKey)
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
            var assignee = userDAO.getUserByEmail(taskDTO.assignee())
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

        var updatedTask = taskDAO.save(task);

        if (task.getAssignee() != null && !task.getAssignee().getId().equals(userId)) {
            var message = "Task '" + task.getSummary() + "' has been updated";
            var link = "/projects?selectedIssue=" + updatedTask.getTaskKey();
            notificationService.createNotification(task.getAssignee(), message,
                    NotificationType.TASK_UPDATED, link);
        }

        return convertToDTO(updatedTask);
    }

    @Transactional(readOnly = true)
    public List<TaskDTO> getTasksAssignedToUser(Integer userId) {
        var tasks = taskDAO.getTasksAssignedToUser(userId);
        return tasks.stream()
                .map(this::convertToDTO)
                .toList();
    }

    public void validateTaskDTO(TaskDTO taskDTO) {
        if (ValidationUtil.isNullOrEmpty(taskDTO.summary())) {
            throw new ValidationException("Summary is required");
        }
        if (taskDTO.status() == null) {
            throw new ValidationException("Status is required");
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
        var dependencyIds = extractDependencyIds(task);
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
                dependencyIds,
                null,
                attachments,
                task.getCreated(),
                task.getUpdated(),
                task.getProgress(),
                task.getPriority()
        );
    }

    private List<String> extractDependencyIds(Task task) {
        if (task.getDependencies() == null || task.getDependencies().isEmpty()) {
            return null;
        }
        return task.getDependencies().stream()
                .map(t -> String.valueOf(t.getId()))
                .toList();
    }

    private List<String> parseLabels(String labelsString) {
        if (labelsString == null || labelsString.isEmpty()) {
            return null;
        }
        return Arrays.asList(labelsString.split(","));
    }

    private void persistProjectWithIncrementedTaskCounter(Project project) {
        projectDAO.save(project);
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

        var numericIds = new ArrayList<Integer>();
        var taskKeyRefs = new ArrayList<String>();
        separateIdsFromKeys(dependencyRefs, numericIds, taskKeyRefs);

        var dependencies = new ArrayList<Task>();
        if (!numericIds.isEmpty()) {
            dependencies.addAll(taskDAO.getTasksByIdsWithDetails(numericIds));
        }
        if (!taskKeyRefs.isEmpty()) {
            dependencies.addAll(taskDAO.getTasksByTaskKeys(taskKeyRefs));
        }
        return dependencies;
    }

    private void separateIdsFromKeys(List<String> refs, List<Integer> numericIds, List<String> taskKeys) {
        for (String ref : refs) {
            if (ref == null) continue;
            try {
                numericIds.add(Integer.parseInt(ref));
            } catch (NumberFormatException e) {
                if (ref.contains("-")) {
                    taskKeys.add(ref);
                }
            }
        }
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
        var project = projectDAO.getProjectByKey(projectKey)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (!project.isOwner(userId)) {
            throw new AuthorizationException("Only project owner can delete tasks");
        }

        var task = taskDAO.getTaskByTaskKey(taskKey)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found: " + taskKey));

        if (!task.getProject().getId().equals(project.getId())) {
            throw new ValidationException("Task does not belong to the specified project");
        }

        deleteTaskAttachmentsSilently(task);
        taskDAO.deleteTask(task);
    }

    private void deleteTaskAttachmentsSilently(Task task) {
        if (task.getAttachments() == null) return;
        for (String attachment : task.getAttachments()) {
            try {
                fileStorageService.deleteFile(attachment);
            } catch (Exception ignored) {
            }
        }
    }
}