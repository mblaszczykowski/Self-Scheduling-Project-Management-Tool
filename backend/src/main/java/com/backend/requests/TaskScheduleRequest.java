package com.backend.requests;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

/**
 * Moves a task in time and nothing else.
 *
 * <p>Exists so a timeline drag has an endpoint that cannot express "and also reset the progress,
 * priority and attachments" — which is exactly what happened when the drag reused the full
 * {@code PUT} and simply omitted those fields.
 */
public record TaskScheduleRequest(
        @NotNull(message = "Start date is required")
        LocalDate startDate,

        @NotNull(message = "Due date is required")
        LocalDate dueDate
) {
    @AssertTrue(message = "Due date must not be before the start date")
    public boolean isDateRangeOrdered() {
        return startDate == null || dueDate == null || !dueDate.isBefore(startDate);
    }
}
