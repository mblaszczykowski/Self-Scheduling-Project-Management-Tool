package com.backend.scheduling;

import java.util.List;

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

    public int plannedStart() {
        return Math.max(releaseOffset, originalStart);
    }
}
