package com.backend.scheduling;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/** Day arithmetic shared by every part of the scheduling subsystem. */
public final class SchedulingSupport {

    private SchedulingSupport() {}

    /**
     * Task duration in whole days, inclusive of both endpoints (Jan 1 to Jan 3 is 3 days), with a
     * floor of 1. Null dates, and inverted ranges, both yield a single day.
     */
    public static int inclusiveDurationDays(LocalDate startDate, LocalDate dueDate) {
        if (startDate == null || dueDate == null) {
            return 1;
        }
        long days = ChronoUnit.DAYS.between(startDate, dueDate);
        return Math.max(1, (int) days + 1);
    }

    /**
     * How much of a task is still ahead of it, given how far along it is.
     *
     * <p>A task reported 90% complete has roughly a tenth of its span left; re-planning it as a
     * full fresh span (which is what ignoring progress amounts to) both misstates the schedule and
     * makes an almost-finished task look like the biggest thing left to do.
     */
    public static int remainingDurationDays(int totalDuration, Integer progressPercent) {
        if (progressPercent == null || progressPercent <= 0) {
            return Math.max(1, totalDuration);
        }
        int bounded = Math.min(100, progressPercent);
        double remainingFraction = (100 - bounded) / 100.0;
        return Math.max(1, (int) Math.ceil(totalDuration * remainingFraction));
    }

    /** Clamps a value into [0, 1]. */
    public static double clampToUnit(double value) {
        if (Double.isNaN(value)) {
            return 0.0;
        }
        return Math.max(0.0, Math.min(1.0, value));
    }
}
