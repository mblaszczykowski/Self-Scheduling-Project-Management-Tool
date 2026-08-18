package com.backend.services;

import com.backend.entities.Task;
import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;
import com.backend.mapper.EntityMapper;

import java.time.LocalDate;
import java.util.List;

/**
 * The auditable state of a task at one instant.
 *
 * <p>Replaces a twenty-parameter {@code logFieldChanges(task, author, oldStatus, newStatus, ...)}
 * where ten adjacent old/new pairs sat one transposition away from a silently wrong audit row —
 * and where adding a field meant widening the signature, which is why description and attachment
 * changes were never recorded despite having enum constants reserved for them.
 */
public record TaskSnapshot(
        TaskStatus status,
        TaskPriority priority,
        String assignee,
        Integer progress,
        LocalDate startDate,
        LocalDate dueDate,
        String summary,
        String description,
        List<String> labels,
        List<String> dependencyKeys,
        List<String> attachments
) {
    public static TaskSnapshot of(Task task) {
        return new TaskSnapshot(
                task.getStatus(),
                task.getPriority(),
                task.getAssignee() != null ? task.getAssignee().getFullName() : null,
                task.getProgress(),
                task.getStartDate(),
                task.getDueDate(),
                task.getSummary(),
                task.getDescription(),
                splitLabels(task.getLabels()),
                EntityMapper.extractDependencyKeys(task),
                List.copyOf(task.getAttachments())
        );
    }

    private static List<String> splitLabels(String labels) {
        if (labels == null || labels.isBlank()) {
            return List.of();
        }
        return java.util.Arrays.stream(labels.split(","))
                .map(String::trim)
                .filter(label -> !label.isEmpty())
                .toList();
    }
}
