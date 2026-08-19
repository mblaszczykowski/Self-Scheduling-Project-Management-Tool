package com.backend.scheduling;

import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * Critical path analysis: the standard forward and backward passes over a precedence graph.
 *
 * <p>Each weakly-connected component gets its <em>own</em> finish time. Using one global finish
 * across everything analysed together meant that whenever more than one project was analysed at
 * once, every project but the longest inherited the longest one's finish, gained artificial float,
 * and reported no critical path at all.
 */
public final class CriticalPathAnalyzer {

    private CriticalPathAnalyzer() {}

    /**
     * @param earliestStart per task, in days from the horizon start
     * @param totalFloat    slack per task; zero means the task is on a critical path
     * @param criticalKeys  the zero-float tasks, in topological order
     */
    public record Analysis(
            Map<String, Integer> earliestStart,
            Map<String, Integer> totalFloat,
            Set<String> criticalKeys
    ) {
        public static Analysis empty() {
            return new Analysis(Map.of(), Map.of(), Set.of());
        }
    }

    public static Analysis analyze(PrecedenceGraph graph) {
        if (graph.tasks().isEmpty()) {
            return Analysis.empty();
        }

        var earliestStart = new HashMap<String, Integer>();
        var earliestFinish = new HashMap<String, Integer>();

        // Forward pass in topological order: every predecessor is final before it is read. The seed
        // is the task's own release date, matching SsgsDecoder.earliestFeasibleStart — seeding at 0
        // reported an earliest start before the task's own start date, and inverted which of two
        // differently-released predecessors was reported as the bottleneck.
        for (var key : graph.topologicalOrder()) {
            int start = graph.task(key).releaseOffset();
            for (var predecessor : graph.knownPredecessorsOf(key)) {
                start = Math.max(start, earliestFinish.getOrDefault(predecessor, 0));
            }
            earliestStart.put(key, start);
            earliestFinish.put(key, start + graph.task(key).duration());
        }

        // One finish time per component, not one for the whole input.
        var componentFinish = new HashMap<Integer, Integer>();
        graph.componentByKey().forEach((key, component) ->
                componentFinish.merge(component, earliestFinish.get(key), Math::max));

        var latestStart = new HashMap<String, Integer>();
        var totalFloat = new HashMap<String, Integer>();
        var critical = new LinkedHashSet<String>();

        // Backward pass in reverse topological order: every successor is final before it is read.
        var order = graph.topologicalOrder();
        for (int i = order.size() - 1; i >= 0; i--) {
            var key = order.get(i);
            var successors = graph.successorsOf(key);
            int latestFinish = successors.isEmpty()
                    ? componentFinish.get(graph.componentByKey().get(key))
                    : successors.stream().mapToInt(latestStart::get).min().orElseThrow();

            int start = latestFinish - graph.task(key).duration();
            latestStart.put(key, start);
            int slack = start - earliestStart.get(key);
            totalFloat.put(key, slack);
            if (slack == 0) {
                critical.add(key);
            }
        }

        return new Analysis(Map.copyOf(earliestStart), Map.copyOf(totalFloat), Set.copyOf(critical));
    }

    /** Convenience for the common case: which tasks are on a critical path. */
    public static Set<String> criticalTaskKeys(PrecedenceGraph graph) {
        return analyze(graph).criticalKeys();
    }
}
