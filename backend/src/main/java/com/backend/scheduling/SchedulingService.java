package com.backend.scheduling;

import com.backend.config.AppProperties;
import com.backend.dtos.TaskDTO;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class SchedulingService {
    private final SsgsDecoder decoder;
    private final int minHorizonDays;

    public SchedulingService(AppProperties appProperties) {
        var optimization = appProperties.getOptimization();
        this.decoder = new SsgsDecoder(optimization.getMaxHorizonDays(),
                optimization.getDependencyWeight());
        this.minHorizonDays = optimization.getMinHorizonDays();
    }

    public Outcome optimize(List<TaskDTO> tasks, List<TaskDTO> anchors,
                            LocalDate horizonStart, double alpha, double beta) {
        var model = ScheduleModel.build(tasks, anchors, horizonStart);
        if (model.scheduleTasks().isEmpty()) {
            return Outcome.empty(horizonStart, model.skippedKeys());
        }

        var graph = PrecedenceGraph.of(model.scheduleTasks());
        var horizon = ScheduleObjective.Horizon.of(graph.tasks().values(), minHorizonDays);

        var current = decoder.asPlanned(graph);
        var currentMetrics = ScheduleEvaluator.evaluate(current, graph, horizon, alpha, beta);

        var metricsByRule = new LinkedHashMap<PriorityRule, ScheduleMetrics>();
        Schedule best = null;
        ScheduleMetrics bestMetrics = null;

        for (var rule : SsgsDecoder.candidateRules()) {
            var candidate = decoder.decode(graph, rule, horizon);
            var metrics = ScheduleEvaluator.evaluate(candidate, graph, horizon, alpha, beta);
            metricsByRule.put(rule, metrics);
            if (bestMetrics == null || metrics.objectiveValue() < bestMetrics.objectiveValue()) {
                best = candidate;
                bestMetrics = metrics;
            }
        }

        return new Outcome(horizonStart, graph, current, currentMetrics, best, bestMetrics,
                CriticalPathAnalyzer.criticalTaskKeys(graph), model.skippedKeys(),
                Collections.unmodifiableMap(metricsByRule));
    }

    public CriticalPathAnalyzer.Analysis analyzeCriticalPath(List<TaskDTO> tasks, LocalDate horizonStart) {
        var model = ScheduleModel.build(tasks, List.of(), horizonStart);
        if (model.scheduleTasks().isEmpty()) {
            return CriticalPathAnalyzer.Analysis.empty();
        }
        return CriticalPathAnalyzer.analyze(PrecedenceGraph.of(model.scheduleTasks()));
    }

    public TaskDTO applyCriticality(TaskDTO task, CriticalPathAnalyzer.Analysis analysis) {
        return task.withCriticality(analysis.criticalKeys().contains(task.taskKey()),
                analysis.totalFloat().get(task.taskKey()));
    }

    public record Outcome(
            LocalDate horizonStart,
            PrecedenceGraph graph,
            Schedule current,
            ScheduleMetrics currentMetrics,
            Schedule chosen,
            ScheduleMetrics chosenMetrics,
            Set<String> criticalKeys,
            List<String> skippedKeys,
            Map<PriorityRule, ScheduleMetrics> metricsByRule
    ) {
        static Outcome empty(LocalDate horizonStart, List<String> skippedKeys) {
            var noMetrics = new ScheduleMetrics(0, 0, 0, 0, 0, 0, true);
            var emptySchedule = new Schedule(Map.of(), PriorityRule.AS_PLANNED);
            return new Outcome(horizonStart, null, emptySchedule, noMetrics, emptySchedule,
                    noMetrics, Set.of(), skippedKeys, Map.of());
        }

        public boolean isEmpty() {
            return graph == null;
        }
    }
}
