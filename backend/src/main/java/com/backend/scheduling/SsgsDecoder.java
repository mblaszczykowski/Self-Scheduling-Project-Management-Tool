package com.backend.scheduling;

import com.backend.exception.ValidationException;

import java.util.ArrayList;
import java.util.BitSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;

public final class SsgsDecoder {
    private final int maxHorizonDays;
    private final double dependencyWeight;

    public SsgsDecoder(int maxHorizonDays, double dependencyWeight) {
        this.maxHorizonDays = maxHorizonDays;
        this.dependencyWeight = dependencyWeight;
    }

    public Schedule decode(PrecedenceGraph graph, PriorityRule rule, ScheduleObjective.Horizon horizon) {
        var placements = new LinkedHashMap<String, Placement>();
        var resourceUsage = new HashMap<String, BitSet>();

        var movable = new ArrayList<ScheduleTask>();
        for (var key : graph.topologicalOrder()) {
            var task = graph.task(key);
            if (task.fixed()) {
                int start = task.plannedStart();
                place(task, start, placements, resourceUsage);
            } else {
                movable.add(task);
            }
        }

        var scores = rule == PriorityRule.MORCPSP ? compositeScores(graph, horizon) : Map.<String, Double>of();
        var order = rule.comparator(scores, graph.transitiveSuccessorCounts());
        var unscheduledPredecessorCount = new HashMap<String, Integer>();
        var ready = new PriorityQueue<>(Math.max(1, movable.size()), order);

        for (var task : movable) {
            int blocking = 0;
            for (var predecessor : graph.knownPredecessorsOf(task.key())) {
                if (!graph.task(predecessor).fixed()) {
                    blocking++;
                }
            }
            unscheduledPredecessorCount.put(task.key(), blocking);
            if (blocking == 0) {
                ready.add(task);
            }
        }

        int placed = 0;
        while (!ready.isEmpty()) {
            var task = ready.poll();
            int start = earliestFeasibleStart(task, graph, placements, resourceUsage);
            place(task, start, placements, resourceUsage);
            placed++;

            for (var successorKey : graph.successorsOf(task.key())) {
                var successor = graph.task(successorKey);
                if (successor.fixed()) {
                    continue;
                }
                var remaining = unscheduledPredecessorCount.get(successorKey);
                if (remaining == null || remaining == 0) {
                    continue;
                }
                unscheduledPredecessorCount.put(successorKey, remaining - 1);
                if (remaining - 1 == 0) {
                    ready.add(successor);
                }
            }
        }

        if (placed < movable.size()) {
            throw new ValidationException(
                    "Circular task dependency detected: schedule cannot be generated");
        }

        return new Schedule(placements, rule);
    }

    public Schedule asPlanned(PrecedenceGraph graph) {
        var placements = new LinkedHashMap<String, Placement>();
        for (var task : graph.tasks().values()) {
            int start = task.plannedStart();
            placements.put(task.key(), toPlacement(task, start));
        }
        return new Schedule(placements, PriorityRule.AS_PLANNED);
    }

    private int earliestFeasibleStart(ScheduleTask task,
                                      PrecedenceGraph graph,
                                      Map<String, Placement> placements,
                                      Map<String, BitSet> resourceUsage) {
        int earliest = task.releaseOffset();
        for (var predecessorKey : graph.knownPredecessorsOf(task.key())) {
            var predecessor = placements.get(predecessorKey);
            if (predecessor != null) {
                earliest = Math.max(earliest, predecessor.end());
            }
        }
        if (!task.hasAssignee()) {
            return earliest;
        }
        return firstFreeSlot(resourceUsage.get(task.assignee()), earliest, task.duration());
    }

    private int firstFreeSlot(BitSet busyDays, int from, int duration) {
        if (busyDays == null) {
            return from;
        }
        int candidate = from;
        for (int guard = 0; guard < maxHorizonDays; guard++) {
            int nextBusy = busyDays.nextSetBit(candidate);
            if (nextBusy < 0 || nextBusy >= candidate + duration) {
                return candidate;
            }
            candidate = busyDays.nextClearBit(nextBusy);
        }
        throw new ValidationException(
                "Cannot schedule within the configured horizon; the assignee is over-committed");
    }

    private void place(ScheduleTask task, int start,
                       Map<String, Placement> placements,
                       Map<String, BitSet> resourceUsage) {
        placements.put(task.key(), toPlacement(task, start));
        if (!task.hasAssignee()) {
            return;
        }
        int from = Math.max(0, start);
        int to = start + task.duration();
        if (to > from) {
            resourceUsage.computeIfAbsent(task.assignee(), key -> new BitSet()).set(from, to);
        }
    }

    private static Placement toPlacement(ScheduleTask task, int start) {
        int end = start + task.duration();
        return new Placement(task.key(), start, end, Math.max(0, end - task.dueOffset()));
    }

    private Map<String, Double> compositeScores(PrecedenceGraph graph, ScheduleObjective.Horizon horizon) {
        var successorCounts = graph.transitiveSuccessorCounts();
        int maxFanOut = successorCounts.values().stream().mapToInt(Integer::intValue).max().orElse(0);

        var scores = new HashMap<String, Double>(graph.tasks().size() * 2);
        for (var task : graph.tasks().values()) {
            double urgency = horizon.urgencyOf(task.dueOffset());
            double fanOut = maxFanOut > 0
                    ? (double) successorCounts.getOrDefault(task.key(), 0) / maxFanOut
                    : 0.0;
            scores.put(task.key(), task.priorityWeight() * urgency + dependencyWeight * fanOut);
        }
        return scores;
    }

    public static List<PriorityRule> candidateRules() {
        return List.of(PriorityRule.MORCPSP, PriorityRule.AS_PLANNED, PriorityRule.LFT,
                PriorityRule.SPT, PriorityRule.MTS);
    }
}
