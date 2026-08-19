package com.backend.scheduling;

import com.backend.exception.ValidationException;

import java.util.ArrayDeque;
import java.util.BitSet;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class PrecedenceGraph {
    private final Map<String, ScheduleTask> tasks;
    private final Map<String, List<String>> successors;
    private final List<String> topologicalOrder;
    private final Map<String, Integer> transitiveSuccessorCounts;

    private PrecedenceGraph(Map<String, ScheduleTask> tasks,
                            Map<String, List<String>> successors,
                            List<String> topologicalOrder) {
        this.tasks = tasks;
        this.successors = successors;
        this.topologicalOrder = topologicalOrder;
        this.transitiveSuccessorCounts = computeTransitiveSuccessorCounts();
    }

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
                if (!tasks.containsKey(predecessor)) {
                    continue;
                }
                successors.get(predecessor).add(task.key());
                inDegree.merge(task.key(), 1, Integer::sum);
            }
        }

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

    public List<String> topologicalOrder() {
        return topologicalOrder;
    }

    public List<String> successorsOf(String key) {
        return successors.getOrDefault(key, List.of());
    }

    public List<String> knownPredecessorsOf(String key) {
        var task = tasks.get(key);
        if (task == null) {
            return List.of();
        }
        return task.predecessors().stream().filter(tasks::containsKey).toList();
    }

    public Map<String, Integer> transitiveSuccessorCounts() {
        return transitiveSuccessorCounts;
    }

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
}
