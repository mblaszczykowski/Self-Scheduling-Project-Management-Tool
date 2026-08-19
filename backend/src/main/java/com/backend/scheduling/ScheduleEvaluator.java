package com.backend.scheduling;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;

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
            if (task.fixed()) {
                continue;
            }
            makespan = Math.max(makespan, placement.end());
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
