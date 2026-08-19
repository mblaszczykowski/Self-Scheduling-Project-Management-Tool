package com.backend.services;

import com.backend.dtos.TaskActivityDTO;
import com.backend.entities.Task;
import com.backend.entities.TaskActivity;
import com.backend.entities.TaskActivityType;
import com.backend.entities.User;
import com.backend.mapper.EntityMapper;
import com.backend.repositories.TaskActivityRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

/** Records what changed on a task, who changed it, and when. */
@Service
public class TaskActivityService {

    private final TaskActivityRepository taskActivityRepository;
    private final EntityMapper entityMapper;

    public TaskActivityService(TaskActivityRepository taskActivityRepository, EntityMapper entityMapper) {
        this.taskActivityRepository = taskActivityRepository;
        this.entityMapper = entityMapper;
    }

    @Transactional(readOnly = true)
    public Page<TaskActivityDTO> getActivitiesForTask(Integer taskId, Pageable pageable) {
        return taskActivityRepository.findByTaskIdWithAuthor(taskId, pageable)
                .map(entityMapper::toTaskActivityDTO);
    }

    @Transactional(rollbackFor = Exception.class)
    public void logCreated(Task task, User author) {
        save(task, author, TaskActivityType.CREATED, null, null, null);
    }

    /** Diffs two snapshots and writes one row per field that actually changed. */
    @Transactional(rollbackFor = Exception.class)
    public void logFieldChanges(Task task, User author, TaskSnapshot before, TaskSnapshot after) {
        if (author == null || before == null || after == null) {
            return;
        }

        logChange(task, author, TaskActivityType.STATUS_CHANGED, "status",
                name(before.status()), name(after.status()));
        logChange(task, author, TaskActivityType.PRIORITY_CHANGED, "priority",
                name(before.priority()), name(after.priority()));
        logChange(task, author, TaskActivityType.ASSIGNEE_CHANGED, "assignee",
                before.assignee(), after.assignee());
        logChange(task, author, TaskActivityType.PROGRESS_CHANGED, "progress",
                text(before.progress()), text(after.progress()));
        logChange(task, author, TaskActivityType.DATES_CHANGED, "dates",
                formatDates(before.startDate(), before.dueDate()),
                formatDates(after.startDate(), after.dueDate()));
        logChange(task, author, TaskActivityType.SUMMARY_CHANGED, "summary",
                before.summary(), after.summary());
        logChange(task, author, TaskActivityType.DESCRIPTION_CHANGED, "description",
                summarize(before.description()), summarize(after.description()));
        logChange(task, author, TaskActivityType.LABELS_CHANGED, "labels",
                joinList(before.labels()), joinList(after.labels()));
        logChange(task, author, TaskActivityType.DEPENDENCIES_CHANGED, "dependencies",
                joinList(before.dependencyKeys()), joinList(after.dependencyKeys()));
        logChange(task, author, TaskActivityType.ATTACHMENTS_CHANGED, "attachments",
                joinSorted(before.attachments()), joinSorted(after.attachments()));
    }

    @Transactional(rollbackFor = Exception.class)
    public void logCommentAdded(Task task, User author) {
        save(task, author, TaskActivityType.COMMENT_ADDED, null, null, null);
    }

    @Transactional(rollbackFor = Exception.class)
    public void logCommentEdited(Task task, User author) {
        save(task, author, TaskActivityType.COMMENT_EDITED, null, null, null);
    }

    @Transactional(rollbackFor = Exception.class)
    public void logCommentDeleted(Task task, User author) {
        save(task, author, TaskActivityType.COMMENT_DELETED, null, null, null);
    }

    private void logChange(Task task, User author, TaskActivityType type, String field,
                           String oldValue, String newValue) {
        if (Objects.equals(blankToNull(oldValue), blankToNull(newValue))) {
            return;
        }
        save(task, author, type, field, oldValue, newValue);
    }

    private void save(Task task, User author, TaskActivityType type,
                      String field, String oldValue, String newValue) {
        taskActivityRepository.save(new TaskActivity(task, author, type, field, oldValue, newValue));
    }

    private static String name(Enum<?> value) {
        return value != null ? value.name() : null;
    }

    private static String text(Object value) {
        return value != null ? String.valueOf(value) : null;
    }

    private static String formatDates(LocalDate start, LocalDate due) {
        return (start != null ? start : "none") + " \u2192 " + (due != null ? due : "none");
    }

    private static String joinList(List<String> values) {
        return values == null || values.isEmpty() ? null : String.join(", ", values);
    }

    /**
     * Descriptions are rich text and can be thousands of characters; the activity feed only needs
     * to say that it changed, so a length marker is recorded rather than two full documents.
     */
    private static String summarize(String description) {
        if (description == null || description.isBlank()) {
            return null;
        }
        return description.length() + " characters";
    }

    /** Attachment order is an append artefact, so the set is compared rather than the sequence. */
    private static String joinSorted(List<String> values) {
        return values == null || values.isEmpty() ? null : values.stream().sorted()
                .collect(java.util.stream.Collectors.joining(", "));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
