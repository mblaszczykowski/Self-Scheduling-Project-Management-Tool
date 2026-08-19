package com.backend.services;

import com.backend.entities.Task;
import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;
import com.backend.mapper.EntityMapper;

import java.time.LocalDate;
import java.util.List;

public record TaskSnapshot(
        TaskStatus status,
        TaskPriority priority,
        Integer assigneeId,
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
                task.getAssignee() != null ? task.getAssignee().getId() : null,
                task.getAssignee() != null ? task.getAssignee().getFullName() : null,
                task.getProgress(),
                task.getStartDate(),
                task.getDueDate(),
                task.getSummary(),
                task.getDescription(),
                EntityMapper.parseLabels(task.getLabels()),
                EntityMapper.extractDependencyKeys(task),
                List.copyOf(task.getAttachments())
        );
    }
}
