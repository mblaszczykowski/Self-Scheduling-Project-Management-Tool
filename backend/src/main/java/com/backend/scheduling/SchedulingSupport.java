package com.backend.scheduling;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

public final class SchedulingSupport {
    private SchedulingSupport() {}

    public static int inclusiveDurationDays(LocalDate startDate, LocalDate dueDate) {
        if (startDate == null || dueDate == null) {
            return 1;
        }
        long days = ChronoUnit.DAYS.between(startDate, dueDate);
        return Math.max(1, (int) days + 1);
    }

    public static int remainingDurationDays(int totalDuration, Integer progressPercent) {
        if (progressPercent == null || progressPercent <= 0) {
            return Math.max(1, totalDuration);
        }
        int bounded = Math.min(100, progressPercent);
        double remainingFraction = (100 - bounded) / 100.0;
        return Math.max(1, (int) Math.ceil(totalDuration * remainingFraction));
    }

    public static double clampToUnit(double value) {
        if (Double.isNaN(value)) {
            return 0.0;
        }
        return Math.max(0.0, Math.min(1.0, value));
    }
}
