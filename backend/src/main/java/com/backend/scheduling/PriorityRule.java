package com.backend.scheduling;

import java.util.Comparator;
import java.util.Map;

public enum PriorityRule {
    MORCPSP("Weighted urgency + fan-out"),

    AS_PLANNED("As planned"),

    SPT("Shortest processing time"),

    LFT("Latest finish time"),

    MTS("Most total successors");

    private final String label;

    PriorityRule(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    Comparator<ScheduleTask> comparator(Map<String, Double> scores, Map<String, Integer> successors) {
        Comparator<ScheduleTask> primary = switch (this) {
            case MORCPSP -> Comparator.comparingDouble(
                    (ScheduleTask t) -> -scores.getOrDefault(t.key(), 0.0));
            case AS_PLANNED -> Comparator.comparingInt(ScheduleTask::plannedStart);
            case SPT -> Comparator.comparingInt(ScheduleTask::duration);
            case LFT -> Comparator.comparingInt(ScheduleTask::dueOffset);
            case MTS -> Comparator.comparingInt(
                    (ScheduleTask t) -> -successors.getOrDefault(t.key(), 0));
        };
        return primary
                .thenComparingInt(ScheduleTask::dueOffset)
                .thenComparingInt(t -> -t.priorityWeight())
                .thenComparing(ScheduleTask::key);
    }
}
