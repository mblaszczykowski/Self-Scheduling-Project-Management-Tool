package com.backend.scheduling;

import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

public final class CriticalPathAnalyzer {
    private CriticalPathAnalyzer() {}

    public record Analysis(
            Map<String, Integer> totalFloat,
            Set<String> criticalKeys
    ) {
        public static Analysis empty() {
            return new Analysis(Map.of(), Set.of());
        }
    }

    public static Analysis analyze(PrecedenceGraph graph) {
        if (graph.tasks().isEmpty()) {
            return Analysis.empty();
        }
        var earliestStart = computeEarliestStarts(graph);
        return scoreSlack(graph, earliestStart);
    }

    public static Set<String> criticalTaskKeys(PrecedenceGraph graph) {
        return analyze(graph).criticalKeys();
    }

    private static Map<String, Integer> computeEarliestStarts(PrecedenceGraph graph) {
        var earliestStart = new HashMap<String, Integer>();
        var earliestFinish = new HashMap<String, Integer>();

        for (var key : graph.topologicalOrder()) {
            var task = graph.task(key);
            int start = task.fixed()
                    ? task.plannedStart()
                    : earliestMovableStart(graph, key, task, earliestFinish);
            earliestStart.put(key, start);
            earliestFinish.put(key, start + task.duration());
        }
        return earliestStart;
    }

    private static int earliestMovableStart(PrecedenceGraph graph, String key, ScheduleTask task,
                                            Map<String, Integer> earliestFinish) {
        int start = task.releaseOffset();
        for (var predecessor : graph.knownPredecessorsOf(key)) {
            start = Math.max(start, earliestFinish.getOrDefault(predecessor, 0));
        }
        return start;
    }

    private static Analysis scoreSlack(PrecedenceGraph graph, Map<String, Integer> earliestStart) {
        var latestStart = new HashMap<String, Integer>();
        var totalFloat = new HashMap<String, Integer>();
        var critical = new LinkedHashSet<String>();

        var order = graph.topologicalOrder();
        for (int i = order.size() - 1; i >= 0; i--) {
            var key = order.get(i);
            var task = graph.task(key);

            if (task.fixed()) {
                latestStart.put(key, task.plannedStart());
                continue;
            }

            int start = latestAcceptableFinish(graph, key, task, latestStart) - task.duration();
            latestStart.put(key, start);

            int slack = start - earliestStart.get(key);
            totalFloat.put(key, slack);
            if (slack <= 0) {
                critical.add(key);
            }
        }
        return new Analysis(Map.copyOf(totalFloat), Set.copyOf(critical));
    }

    private static int latestAcceptableFinish(PrecedenceGraph graph, String key, ScheduleTask task,
                                              Map<String, Integer> latestStart) {
        int latestFinish = task.dueOffset();
        for (var successor : graph.successorsOf(key)) {
            if (graph.task(successor).fixed()) {
                continue;
            }
            latestFinish = Math.min(latestFinish, latestStart.get(successor));
        }
        return latestFinish;
    }
}
