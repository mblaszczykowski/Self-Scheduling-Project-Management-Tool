package com.backend.util;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/** Shared scheduling helpers used by both {@link ScheduleOptimizer} and {@link CriticalPathMethodHelper}. */
public final class SchedulingSupport {

    private SchedulingSupport() {}

    /**
     * Task duration in whole days, inclusive of both endpoints (Jan 1 → Jan 3 = 3 days),
     * with a floor of 1. Null dates default to a single day.
     */
    public static int inclusiveDurationDays(LocalDate startDate, LocalDate dueDate) {
        if (startDate == null || dueDate == null) {
            return 1;
        }
        long days = ChronoUnit.DAYS.between(startDate, dueDate);
        return Math.max(1, (int) days + 1);
    }
}
