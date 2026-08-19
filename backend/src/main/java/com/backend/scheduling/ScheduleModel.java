package com.backend.scheduling;

import com.backend.dtos.TaskDTO;
import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

public final class ScheduleModel {
    private static final Set<TaskStatus> TERMINAL_STATUSES =
            Set.of(TaskStatus.DONE, TaskStatus.RELEASED, TaskStatus.WITHDRAWN);

    private ScheduleModel() {}

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

    public record Result(List<ScheduleTask> scheduleTasks, List<String> skippedKeys) {}

    private static ScheduleTask toScheduleTask(TaskDTO dto, LocalDate horizonStart, boolean forceFixed) {
        if (dto.taskKey() == null || dto.startDate() == null || dto.dueDate() == null) {
            return null;
        }

        int totalDuration = SchedulingSupport.inclusiveDurationDays(dto.startDate(), dto.dueDate());
        boolean completed = dto.status() != null && TERMINAL_STATUSES.contains(dto.status());
        boolean fixed = forceFixed || completed;

        int duration = fixed ? totalDuration
                : SchedulingSupport.remainingDurationDays(totalDuration, dto.progress());

        int originalStart = (int) ChronoUnit.DAYS.between(horizonStart, dto.startDate());
        int dueOffset = (int) ChronoUnit.DAYS.between(horizonStart, dto.dueDate()) + 1;

        int releaseOffset = fixed ? originalStart : Math.max(0, originalStart);

        int weight = dto.priority() != null ? dto.priority().getWeight() : TaskPriority.MEDIUM.getWeight();

        return new ScheduleTask(dto.taskKey(), duration, releaseOffset, originalStart, dueOffset,
                weight, dto.assignee(), dto.dependencyKeys(), fixed);
    }
}
