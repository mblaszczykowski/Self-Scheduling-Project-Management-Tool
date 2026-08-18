package com.backend.scheduling;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;

/** Turns a {@link Schedule} into comparable numbers. */
public final class ScheduleEvaluator {

    private ScheduleEvaluator() {}

    public static ScheduleMetrics evaluate(Schedule schedule,
                                           PrecedenceGraph graph,
                                           ScheduleObjective.Horizon horizon,
                                           double alpha,
                                           double beta) {
        double weightedTardiness = 0.0;
        int makespan = 0;
        int totalTasks = 0;
        int tasksLate = 0;

        for (var placement : schedule.all()) {
            var task = graph.task(placement.key());
            if (task == null) {
                continue;
            }
            makespan = Math.max(makespan, placement.end());
            if (task.fixed()) {
                // Completed work and outside anchors bound the timeline but are not what the
                // optimizer is being judged on.
                continue;
            }
            totalTasks++;
            weightedTardiness += (double) task.priorityWeight() * placement.tardiness();
            if (placement.tardiness() > 0) {
                tasksLate++;
            }
        }

        int conflicts = countResourceConflicts(schedule, graph);
        double objective = ScheduleObjective.value(weightedTardiness, makespan, horizon, alpha, beta);

        return new ScheduleMetrics(weightedTardiness, makespan, objective,
                totalTasks, tasksLate, conflicts, conflicts == 0);
    }

    /**
     * Counts unordered pairs of same-assignee tasks whose day ranges overlap.
     *
     * <p>Order-invariant, which the previous "does this task clash with an earlier-iterated one"
     * count was not: the same three overlapping tasks reported 2, 1 or 2 conflicts depending on
     * the order the database happened to return them in, so adding a task to one project could
     * change another project's reported conflict count.
     *
     * <p>Sweep line per assignee: O(k log k) in the number of tasks that person holds.
     */
    private static int countResourceConflicts(Schedule schedule, PrecedenceGraph graph) {
        var byAssignee = new HashMap<String, List<Placement>>();
        for (var placement : schedule.all()) {
            var task = graph.task(placement.key());
            if (task == null || !task.hasAssignee() || placement.start() >= placement.end()) {
                continue;
            }
            byAssignee.computeIfAbsent(task.assignee(), key -> new ArrayList<>()).add(placement);
        }

        int conflicts = 0;
        for (var placements : byAssignee.values()) {
            if (placements.size() < 2) {
                continue;
            }
            placements.sort(Comparator.comparingInt(Placement::start).thenComparingInt(Placement::end));
            for (int i = 0; i < placements.size(); i++) {
                var current = placements.get(i);
                for (int j = i + 1; j < placements.size(); j++) {
                    var later = placements.get(j);
                    // Sorted by start, so once a task starts at or after this one ends, so does
                    // everything after it.
                    if (later.start() >= current.end()) {
                        break;
                    }
                    conflicts++;
                }
            }
        }
        return conflicts;
    }
}
