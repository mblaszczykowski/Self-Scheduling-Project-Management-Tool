package com.backend.scheduling;

import java.util.Comparator;
import java.util.Map;

/**
 * The order in which the serial decoder considers eligible tasks.
 *
 * <p>Every rule is a <em>total</em> order — ties break down to the task key — so a schedule is
 * reproducible from the same input regardless of map iteration order or sort stability.
 */
public enum PriorityRule {

    /**
     * The composite rule of the MORCPSP model: business weight scaled by urgency, plus a bounded
     * bonus for how much work sits downstream.
     */
    MORCPSP("Weighted urgency + fan-out"),

    /** As planned: whatever the current schedule starts first goes first. The baseline. */
    AS_PLANNED("As planned"),

    /** Shortest processing time first: minimises average flow time, ignores priorities. */
    SPT("Shortest processing time"),

    /** Latest finish time first: the classic due-date-driven rule. */
    LFT("Latest finish time"),

    /** Most total successors first: unblocks the largest downstream subtree earliest. */
    MTS("Most total successors");

    private final String label;

    PriorityRule(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    /**
     * @param scores        composite MORCPSP score per task key (higher first)
     * @param successors    transitive successor count per task key
     */
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
