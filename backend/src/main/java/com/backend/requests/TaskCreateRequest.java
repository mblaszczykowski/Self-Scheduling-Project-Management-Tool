package com.backend.requests;

import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;
import jakarta.validation.constraints.*;

import java.time.LocalDate;
import java.util.List;

public record TaskCreateRequest(
        @NotBlank(message = "Summary is required")
        @Size(max = 200, message = "Summary must not exceed 200 characters")
        String summary,

        @Size(max = 5000, message = "Description must not exceed 5000 characters")
        String description,

        TaskStatus status,
        TaskPriority priority,

        @Min(value = 0, message = "Progress must be between 0 and 100")
        @Max(value = 100, message = "Progress must be between 0 and 100")
        Integer progress,

        LocalDate startDate,
        LocalDate dueDate,
        String assignee,
        List<String> labels,
        List<String> dependencyKeys,
        List<String> attachments
) {}
