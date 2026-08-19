package com.backend.scheduling;

public record ScheduleMetrics(
        double weightedTardiness,
        int makespan,
        double objectiveValue,
        int totalTasks,
        int tasksLate,
        int resourceConflicts,
        boolean feasible
) {
    public int tasksOnTime() {
        return totalTasks - tasksLate;
    }
}
