package com.backend.scheduling;

import com.backend.exception.ValidationException;

import java.util.ArrayDeque;
import java.util.BitSet;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The precedence structure of one scheduling problem, computed once and reused.
 *
 * <p>One authoritative implementation of topological order, transitive fan-out, connected
 * components and cycle detection. These were previously reimplemented in the optimizer, in the
 * critical-path helper and in four separate research harnesses; the copies drifted, and one of
 * them is exactly where a unit mismatch in the objective function crept in.
 *
 * <p>Iteration order follows insertion order of the input, so every derived quantity is
 * reproducible.
 */
public final class PrecedenceGraph {

    private final Map<String, ScheduleTask> tasks;
    private final Map<String, List<String>> successors;
    private final List<String> topologicalOrder;
    private final Map<String, Integer> transitiveSuccessorCounts;
    private final Map<String, Integer> componentByKey;
    private final int componentCount;

    private PrecedenceGraph(Map<String, ScheduleTask> tasks,
                            Map<String, List<String>> successors,
                            List<String> topologicalOrder) {
        this.tasks = tasks;
        this.successors = successors;
        this.topologicalOrder = topologicalOrder;
        this.transitiveSuccessorCounts = computeTransitiveSuccessorCounts();
        var components = computeComponents();
        this.componentByKey = components.assignment();
        this.componentCount = components.count();
    }

    /**
     * @throws ValidationException if the dependencies contain a cycle — an unschedulable input
     *                             that must be reported, not silently mis-scheduled
     */
    public static PrecedenceGraph of(List<ScheduleTask> input) {
        var tasks = new LinkedHashMap<String, ScheduleTask>();
        for (var task : input) {
            tasks.put(task.key(), task);
        }

        var successors = new LinkedHashMap<String, List<String>>();
        var inDegree = new HashMap<String, Integer>();
        for (var key : tasks.keySet()) {
            successors.put(key, new ArrayList<>());
            inDegree.put(key, 0);
        }
        for (var task : tasks.values()) {
            for (var predecessor : task.predecessors()) {
                // A predecessor outside this problem imposes no ordering here; the caller is
                // responsible for pulling in the ones that matter as fixed anchors.
                if (!tasks.containsKey(predecessor)) {
                    continue;
                }
                successors.get(predecessor).add(task.key());
                inDegree.merge(task.key(), 1, Integer::sum);
            }
        }

        // Kahn, in insertion order, so the topological order is deterministic.
        var order = new ArrayList<String>(tasks.size());
        var ready = new ArrayDeque<String>();
        for (var key : tasks.keySet()) {
            if (inDegree.get(key) == 0) {
                ready.add(key);
            }
        }
        while (!ready.isEmpty()) {
            var key = ready.poll();
            order.add(key);
            for (var successor : successors.get(key)) {
                if (inDegree.merge(successor, -1, Integer::sum) == 0) {
                    ready.add(successor);
                }
            }
        }
        if (order.size() != tasks.size()) {
            throw new ValidationException(
                    "Circular task dependency detected: schedule cannot be generated");
        }

        return new PrecedenceGraph(tasks, successors, List.copyOf(order));
    }

    public Map<String, ScheduleTask> tasks() {
        return tasks;
    }

    public ScheduleTask task(String key) {
        return tasks.get(key);
    }

    /** Predecessors first. */
    public List<String> topologicalOrder() {
        return topologicalOrder;
    }

    public List<String> successorsOf(String key) {
        return successors.getOrDefault(key, List.of());
    }

    /** Predecessors of a task that are part of this graph. */
    public List<String> knownPredecessorsOf(String key) {
        var task = tasks.get(key);
        if (task == null) {
            return List.of();
        }
        return task.predecessors().stream().filter(tasks::containsKey).toList();
    }

    /** How many tasks lie downstream of each task, transitively. */
    public Map<String, Integer> transitiveSuccessorCounts() {
        return transitiveSuccessorCounts;
    }

    /**
     * Index of the weakly-connected component each task belongs to.
     *
     * <p>Critical-path analysis needs this: a project's own finish time is the finish of its own
     * component, not of the longest unrelated project that happened to be analysed alongside it.
     */
    public Map<String, Integer> componentByKey() {
        return componentByKey;
    }

    public int componentCount() {
        return componentCount;
    }

    /**
     * Exact count of distinct downstream tasks per task.
     *
     * <p>Reachability is accumulated as bit sets in reverse topological order, which counts a task
     * reachable by two different paths once. Summing {@code 1 + count(successor)} instead — the
     * obvious shortcut — double-counts every diamond in the graph.
     */
    private Map<String, Integer> computeTransitiveSuccessorCounts() {
        var indexByKey = new HashMap<String, Integer>(topologicalOrder.size() * 2);
        var keys = new ArrayList<>(tasks.keySet());
        for (int i = 0; i < keys.size(); i++) {
            indexByKey.put(keys.get(i), i);
        }

        var reachable = new BitSet[keys.size()];
        var counts = new LinkedHashMap<String, Integer>();

        for (int i = topologicalOrder.size() - 1; i >= 0; i--) {
            var key = topologicalOrder.get(i);
            var own = new BitSet(keys.size());
            for (var successor : successors.get(key)) {
                var successorIndex = indexByKey.get(successor);
                own.set(successorIndex);
                var downstream = reachable[successorIndex];
                if (downstream != null) {
                    own.or(downstream);
                }
            }
            reachable[indexByKey.get(key)] = own;
            counts.put(key, own.cardinality());
        }
        return Map.copyOf(counts);
    }

    private Components computeComponents() {
        var parent = new HashMap<String, String>();
        for (var key : tasks.keySet()) {
            parent.put(key, key);
        }
        for (var task : tasks.values()) {
            for (var predecessor : task.predecessors()) {
                if (tasks.containsKey(predecessor)) {
                    union(parent, task.key(), predecessor);
                }
            }
        }
        var indexByRoot = new LinkedHashMap<String, Integer>();
        var assignment = new LinkedHashMap<String, Integer>();
        for (var key : tasks.keySet()) {
            var root = find(parent, key);
            assignment.put(key, indexByRoot.computeIfAbsent(root, r -> indexByRoot.size()));
        }
        return new Components(Map.copyOf(assignment), indexByRoot.size());
    }

    private static String find(Map<String, String> parent, String key) {
        var root = key;
        while (!parent.get(root).equals(root)) {
            root = parent.get(root);
        }
        // Path compression keeps repeated lookups cheap on long dependency chains.
        var current = key;
        while (!parent.get(current).equals(root)) {
            var next = parent.get(current);
            parent.put(current, root);
            current = next;
        }
        return root;
    }

    private static void union(Map<String, String> parent, String a, String b) {
        var rootA = find(parent, a);
        var rootB = find(parent, b);
        if (!rootA.equals(rootB)) {
            parent.put(rootA, rootB);
        }
    }

    private record Components(Map<String, Integer> assignment, int count) {}
}
