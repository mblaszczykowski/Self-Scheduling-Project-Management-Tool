package com.backend.requests;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record TaskScheduleRequest(
        @NotNull(message = "Start date is required")
        LocalDate startDate,

        @NotNull(message = "Due date is required")
        LocalDate dueDate
) {
    @JsonIgnore
    @AssertTrue(message = "Due date must not be before the start date")
    public boolean isDateRangeOrdered() {
        return startDate == null || dueDate == null || !dueDate.isBefore(startDate);
    }

    @JsonIgnore
    @AssertTrue(message = "Task dates must use years between 0001 and 9999")
    public boolean isDateRangeSupported() {
        return TaskRequest.supportedDate(startDate) && TaskRequest.supportedDate(dueDate);
    }
}
