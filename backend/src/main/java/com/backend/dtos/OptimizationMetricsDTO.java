package com.backend.dtos;

public record OptimizationMetricsDTO(
        double weightedTardiness,
        int makespan,
        double objectiveValue,
        int totalTasks,
        int tasksOnTime,
        int tasksLate,
        int resourceConflicts
) {}
