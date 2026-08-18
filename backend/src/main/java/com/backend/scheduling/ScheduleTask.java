package com.backend.scheduling;

import java.util.List;

/**
 * One task as the scheduler sees it: pure integers on a day axis, no entities, no dates.
 *
 * <p>All offsets are days relative to the horizon start (day 0). {@code end} offsets are
 * exclusive, so a task occupying Jan 1 to Jan 3 has {@code start = 0, end = 3}.
 *
 * @param key              the task key, used for precedence links and for reporting
 * @param duration         remaining work in days, at least 1
 * @param releaseOffset    the earliest day this task may start; never negative
 * @param originalStart    where the current plan puts it (may be negative, i.e. in the past)
 * @param dueOffset        exclusive end of the due date, so tardiness is {@code end - dueOffset}
 * @param priorityWeight   w_j on a 1..10 scale
 * @param assignee         the resource that must not be double-booked, or null if unassigned
 * @param predecessors     keys this task must follow
 * @param fixed            true for completed tasks and for anchors pulled in from outside the
 *                         optimized set: their placement is a constraint, not a decision
 */
public record ScheduleTask(
        String key,
        int duration,
        int releaseOffset,
        int originalStart,
        int dueOffset,
        int priorityWeight,
        String assignee,
        List<String> predecessors,
        boolean fixed
) {
    public ScheduleTask {
        predecessors = predecessors == null ? List.of() : List.copyOf(predecessors);
    }

    public boolean hasAssignee() {
        return assignee != null && !assignee.isBlank();
    }

    /** Where the current plan places this task, on the same axis the optimizer works on. */
    public int plannedStart() {
        return Math.max(releaseOffset, originalStart);
    }
}
