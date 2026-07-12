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
        List<String> attachments,
        Instant created,
        Instant updated,
        Integer progress,
        TaskPriority priority
) {
    /** Returns a copy with the critical-path flag set (avoids fragile full-field rebuilds). */
    public TaskDTO withIsCritical(Boolean isCritical) {
        return new TaskDTO(id, taskNumber, taskKey, projectKey, summary, description, status,
                startDate, dueDate, assignee, labels, dependencyKeys, isCritical, attachments,
                created, updated, progress, priority);
    }
}