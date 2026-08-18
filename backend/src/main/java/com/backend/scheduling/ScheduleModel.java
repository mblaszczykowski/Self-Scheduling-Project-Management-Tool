package com.backend.scheduling;

import com.backend.dtos.TaskDTO;
import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Translates task DTOs into the integer day-offset model the scheduler works on.
 *
 * <p>Three modelling decisions live here, and all three exist because their absence produced
 * visibly wrong output:
 *
 * <ul>
 *   <li><b>Release dates.</b> A task may not start before {@code max(0, its planned start)}.
 *       Without this the optimizer's only lower bound was "today", so a task planned for next
 *       quarter was dragged nine months forward and almost every task came back marked as
 *       shifted — turning "resolve my conflicts" into "compress the whole portfolio into now".</li>
 *   <li><b>Remaining work.</b> Duration is scaled by progress. A task reported 90% done was
 *       otherwise re-planned as a full fresh span, and could even be pushed to start later than it
 *       already had.</li>
 *   <li><b>One axis for both schedules.</b> The current plan and any candidate are built from the
 *       same release dates and the same remaining durations, so "nothing to optimize" produces
 *       identical numbers on both sides. Previously the baseline was credited with work already
 *       consumed in the past while the candidate was charged for it in full, which made the
 *       optimizer report itself making things worse for any overdue task.</li>
 * </ul>
 */
public final class ScheduleModel {

    /** Statuses that mean the work is finished; these are constraints, not decisions. */
    private static final Set<TaskStatus> TERMINAL_STATUSES =
            Set.of(TaskStatus.DONE, TaskStatus.RELEASED, TaskStatus.WITHDRAWN);

    private ScheduleModel() {}

    /**
     * @param tasks       the tasks to schedule
     * @param anchors     tasks outside the optimized set that constrain it (cross-project
     *                    predecessors); always fixed
     * @param horizonStart day 0 of the model
     */
    public static Result build(List<TaskDTO> tasks, List<TaskDTO> anchors, LocalDate horizonStart) {
        var built = new ArrayList<ScheduleTask>();
        var skipped = new ArrayList<String>();

        for (var dto : tasks) {
            var task = toScheduleTask(dto, horizonStart, false);
            if (task == null) {
                skipped.add(dto.taskKey() != null ? dto.taskKey() : "(unnamed task)");
            } else {
                built.add(task);
            }
        }
        for (var dto : anchors) {
            var task = toScheduleTask(dto, horizonStart, true);
            if (task != null) {
                built.add(task);
            }
        }

        return new Result(List.copyOf(built), List.copyOf(skipped));
    }

    /**
     * @param scheduleTasks the model, including anchors
     * @param skippedKeys   tasks that could not be modelled because they have no dates; reported
     *                      so the UI can say why they are missing instead of silently omitting them
     */
    public record Result(List<ScheduleTask> scheduleTasks, List<String> skippedKeys) {}

    private static ScheduleTask toScheduleTask(TaskDTO dto, LocalDate horizonStart, boolean forceFixed) {
        if (dto.taskKey() == null || dto.startDate() == null || dto.dueDate() == null) {
            return null;
        }

        int totalDuration = SchedulingSupport.inclusiveDurationDays(dto.startDate(), dto.dueDate());
        boolean completed = dto.status() != null && TERMINAL_STATUSES.contains(dto.status());
        boolean fixed = forceFixed || completed;

        // Completed work keeps its full historical span; only work still ahead is discounted.
        int duration = fixed ? totalDuration
                : SchedulingSupport.remainingDurationDays(totalDuration, dto.progress());

        int originalStart = (int) ChronoUnit.DAYS.between(horizonStart, dto.startDate());
        // Exclusive end: a task due on Jan 3 is late only once it finishes after the end of Jan 3.
        int dueOffset = (int) ChronoUnit.DAYS.between(horizonStart, dto.dueDate()) + 1;

        // Fixed tasks may sit in the past; movable work cannot be scheduled backwards in time.
        int releaseOffset = fixed ? originalStart : Math.max(0, originalStart);

        int weight = dto.priority() != null ? dto.priority().getWeight() : TaskPriority.MEDIUM.getWeight();

        return new ScheduleTask(dto.taskKey(), duration, releaseOffset, originalStart, dueOffset,
                weight, dto.assignee(), dto.dependencyKeys(), fixed);
    }
}
