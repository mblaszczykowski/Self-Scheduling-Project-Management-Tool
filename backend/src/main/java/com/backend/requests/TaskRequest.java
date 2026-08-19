package com.backend.requests;

import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

public record TaskRequest(
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

        @Size(max = 10, message = "A task cannot have more than 10 labels")
        List<@Size(max = 20, message = "A label must not exceed 20 characters")
                @Pattern(regexp = "[^,]*", message = "A label must not contain a comma") String> labels,

        @Size(max = 50, message = "A task cannot depend on more than 50 tasks")
        List<@NotBlank String> dependencyKeys,

        @Size(max = 50, message = "A task cannot have more than 50 attachments")
        List<@NotBlank String> attachments
) {
    @JsonIgnore
    @AssertTrue(message = "Due date must not be before the start date")
    public boolean isDateRangeOrdered() {
        return startDate == null || dueDate == null || !dueDate.isBefore(startDate);
    }
}
