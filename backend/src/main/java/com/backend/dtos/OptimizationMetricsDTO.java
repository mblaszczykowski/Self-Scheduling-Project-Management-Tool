package com.backend.dtos;

/**
 * @param feasible whether the schedule respects resource capacity. The "before" figures describe
 *                 the plan as it stands, which may double-book people — so its makespan and
 *                 tardiness are optimistic, and the UI needs to be able to say so rather than
 *                 presenting them as comparable to a feasible schedule's.
 */
public record OptimizationMetricsDTO(
        double weightedTardiness,
        int makespan,
        double objectiveValue,
        int totalTasks,
        int tasksOnTime,
        int tasksLate,
        int resourceConflicts,
        boolean feasible
) {}
