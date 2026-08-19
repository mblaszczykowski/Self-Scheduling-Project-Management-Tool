package com.backend.dtos;

import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;
import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record TaskDTO(
        Integer id,
        Integer taskNumber,
        String taskKey,
        String projectKey,
        String summary,
        String description,
        TaskStatus status,
        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate startDate,
        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate dueDate,
        String assignee,
        List<String> labels,
        List<String> dependencyKeys,
        Boolean isCritical,
        Integer totalFloat,
        List<String> attachments,
        Instant created,
        Instant updated,
        Integer progress,
        TaskPriority priority
) {
    /**
     * Returns a copy with the derived critical-path values set (avoids fragile full-field rebuilds).
     *
     * @param totalFloat slack in days; zero means the task is on a critical path
     */
    public TaskDTO withCriticality(Boolean isCritical, Integer totalFloat) {
        return new TaskDTO(id, taskNumber, taskKey, projectKey, summary, description, status,
                startDate, dueDate, assignee, labels, dependencyKeys, isCritical, totalFloat,
                attachments, created, updated, progress, priority);
    }
}