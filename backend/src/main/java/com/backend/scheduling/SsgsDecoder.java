package com.backend.scheduling;

import com.backend.exception.ValidationException;

import java.util.ArrayList;
import java.util.BitSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;

/**
 * Serial Schedule Generation Scheme: the eligible-set decoder at the heart of the optimizer.
 *
 * <p>At every step it takes the highest-priority task whose predecessors are <em>all</em> already
 * placed, and puts it at the earliest day that satisfies its release date, its predecessors'
 * finish times, and its assignee's availability. Because a task is only ever considered once all
 * of its predecessors are final, the result is precedence-feasible by construction — no repair
 * pass, no possibility of a high-priority successor slipping in front of a low-priority
 * predecessor.
 *
 * <p>Stateless and therefore safe to share.
 *
 * <p>Complexity: O(n log n + n·H) where n is the task count and H the horizon in days.
 */
public final class SsgsDecoder {

    /** Safety bound on the resource search, far above any real horizon. */
    private final int maxHorizonDays;
    private final double dependencyWeight;

    public SsgsDecoder(int maxHorizonDays, double dependencyWeight) {
        this.maxHorizonDays = maxHorizonDays;
        this.dependencyWeight = dependencyWeight;
    }

    /**
     * @param graph  the problem; fixed tasks act as immovable precedence and resource constraints
     * @param rule   the order in which eligible tasks are chosen
     * @throws ValidationException if some task can never become eligible (a cycle the graph
     *                             construction did not already reject)
     */
    public Schedule decode(PrecedenceGraph graph, PriorityRule rule, ScheduleObjective.Horizon horizon) {
        var placements = new LinkedHashMap<String, Placement>();
        var resourceUsage = new HashMap<String, BitSet>();

        // Fixed tasks are placed first and occupy their resources, so movable work schedules
        // around them instead of on top of them.
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

        var order = rule.comparator(compositeScores(graph, horizon), graph.transitiveSuccessorCounts());
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

    /** Places every task exactly where the current plan puts it, ignoring feasibility. */
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

    /**
     * Earliest day at or after {@code from} where the resource has {@code duration} consecutive
     * free days. Guaranteed to terminate: {@code nextClearBit} of a set bit is strictly greater,
     * so the candidate always advances.
     */
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
        if (task.hasAssignee()) {
            resourceUsage.computeIfAbsent(task.assignee(), key -> new BitSet())
                    .set(Math.max(0, start), Math.max(0, start) + task.duration());
        }
    }

    private static Placement toPlacement(ScheduleTask task, int start) {
        int end = start + task.duration();
        return new Placement(task.key(), start, end, Math.max(0, end - task.dueOffset()));
    }

    /**
     * The MORCPSP composite score: {@code w_j * urgency + dependencyWeight * normalisedFanOut}.
     *
     * <p>Both factors are in [0, 1] and {@code w_j} is in [1, 10], so business priority stays the
     * dominant driver while downstream fan-out breaks ties meaningfully. The fan-out term is
     * normalised by the largest fan-out in the problem, so it cannot grow without bound and swamp
     * the priority signal on a densely linked portfolio.
     */
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

    /** Rules worth trying, in the order they are reported. */
    public static List<PriorityRule> candidateRules() {
        return List.of(PriorityRule.MORCPSP, PriorityRule.AS_PLANNED, PriorityRule.LFT,
                PriorityRule.SPT, PriorityRule.MTS);
    }
}
