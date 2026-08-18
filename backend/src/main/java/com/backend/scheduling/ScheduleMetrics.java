package com.backend.scheduling;

/**
 * What a schedule costs, on the same axis for every schedule of the same problem.
 *
 * @param weightedTardiness sum of w_j times days late
 * @param makespan          day offset at which the last task finishes
 * @param objectiveValue    Z, in [0, 1] when alpha + beta = 1
 * @param totalTasks        how many movable tasks were measured
 * @param tasksLate         how many finish after their due date
 * @param resourceConflicts unordered pairs of same-assignee tasks that overlap in time
 * @param feasible          whether the schedule respects resource capacity at all
 */
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
