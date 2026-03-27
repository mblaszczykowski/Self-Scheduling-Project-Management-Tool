package com.backend.services;

import com.backend.dtos.TaskActivityDTO;
import com.backend.entities.*;
import com.backend.repositories.TaskActivityRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

@Service
public class TaskActivityService {

    private final TaskActivityRepository taskActivityRepository;

    public TaskActivityService(TaskActivityRepository taskActivityRepository) {
        this.taskActivityRepository = taskActivityRepository;
    }

    @Transactional(readOnly = true)
    public List<TaskActivityDTO> getActivitiesForTask(Integer taskId) {
        return taskActivityRepository.findByTaskIdWithAuthor(taskId).stream()
                .map(this::convertToDTO)
                .toList();
    }

    public void logCreated(Task task, User author) {
        save(new TaskActivity(task, author, TaskActivityType.CREATED, null, null, null));
    }

    public void logFieldChanges(Task task, User author,
                                TaskStatus oldStatus, TaskStatus newStatus,
                                TaskPriority oldPriority, TaskPriority newPriority,
                                String oldAssignee, String newAssignee,
                                Integer oldProgress, Integer newProgress,
                                String oldStartDate, String newStartDate,
                                String oldDueDate, String newDueDate,
                                String oldSummary, String newSummary,
                                String oldLabels, String newLabels,
                                String oldDeps, String newDeps) {
        if (!Objects.equals(oldStatus, newStatus)) {
            save(new TaskActivity(task, author, TaskActivityType.STATUS_CHANGED, "status",
                    formatEnum(oldStatus), formatEnum(newStatus)));
        }
        if (!Objects.equals(oldPriority, newPriority)) {
            save(new TaskActivity(task, author, TaskActivityType.PRIORITY_CHANGED, "priority",
                    formatEnum(oldPriority), formatEnum(newPriority)));
        }
        if (!Objects.equals(oldAssignee, newAssignee)) {
            save(new TaskActivity(task, author, TaskActivityType.ASSIGNEE_CHANGED, "assignee",
                    oldAssignee, newAssignee));
        }
        if (!Objects.equals(oldProgress, newProgress)) {
            save(new TaskActivity(task, author, TaskActivityType.PROGRESS_CHANGED, "progress",
                    String.valueOf(oldProgress), String.valueOf(newProgress)));
        }
        if (!Objects.equals(oldStartDate, newStartDate) || !Objects.equals(oldDueDate, newDueDate)) {
            var oldDates = formatDates(oldStartDate, oldDueDate);
            var newDates = formatDates(newStartDate, newDueDate);
            if (!oldDates.equals(newDates)) {
                save(new TaskActivity(task, author, TaskActivityType.DATES_CHANGED, "dates", oldDates, newDates));
            }
        }
        if (!Objects.equals(oldSummary, newSummary)) {
            save(new TaskActivity(task, author, TaskActivityType.SUMMARY_CHANGED, "summary", oldSummary, newSummary));
        }
        if (!Objects.equals(normalize(oldLabels), normalize(newLabels))) {
            save(new TaskActivity(task, author, TaskActivityType.LABELS_CHANGED, "labels",
                    emptyIfNull(oldLabels), emptyIfNull(newLabels)));
        }
        if (!Objects.equals(normalize(oldDeps), normalize(newDeps))) {
            save(new TaskActivity(task, author, TaskActivityType.DEPENDENCIES_CHANGED, "dependencies",
                    emptyIfNull(oldDeps), emptyIfNull(newDeps)));
        }
    }

    public void logCommentAdded(Task task, User author) {
        save(new TaskActivity(task, author, TaskActivityType.COMMENT_ADDED, null, null, null));
    }

    public void logCommentDeleted(Task task, User author) {
        save(new TaskActivity(task, author, TaskActivityType.COMMENT_DELETED, null, null, null));
    }

    private void save(TaskActivity activity) {
        taskActivityRepository.save(activity);
    }

    private TaskActivityDTO convertToDTO(TaskActivity activity) {
        var author = activity.getAuthor();
        return new TaskActivityDTO(
                activity.getId(),
                activity.getType(),
                activity.getFieldName(),
                activity.getOldValue(),
                activity.getNewValue(),
                author != null ? author.getFullName() : null,
                author != null ? author.getProfilePicture() : null,
                activity.getTimestamp()
        );
    }

    private String formatEnum(Enum<?> val) {
        return val != null ? val.name() : null;
    }

    private String formatDates(String start, String due) {
        return (start != null ? start : "none") + " → " + (due != null ? due : "none");
    }

    private String normalize(String s) {
        return s == null || s.isEmpty() ? null : s;
    }

    private String emptyIfNull(String s) {
        return s == null ? "" : s;
    }
}
