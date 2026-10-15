package com.backend.scheduling;

import com.backend.config.AppProperties;
import com.backend.dtos.TaskDTO;
import com.backend.entities.TaskStatus;
import com.backend.exception.ValidationException;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

@Service
public class SchedulingService {
    private static final Set<TaskStatus> TERMINAL_STATUSES =
            Set.of(TaskStatus.DONE, TaskStatus.RELEASED, TaskStatus.WITHDRAWN);
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
        if ((long) tasks.size() + anchors.size() > 5000) {
            throw new ValidationException("At most 5000 tasks can be optimized at once");
        }
        if (!Double.isFinite(alpha) || !Double.isFinite(beta)
                || alpha < 0 || alpha > 1 || beta < 0 || beta > 1) {
            throw new ValidationException("Optimization weights must be between 0 and 1");
        }
        var model = ScheduleModel.build(tasks, anchors, horizonStart);
        if (model.scheduleTasks().isEmpty()) {
            return Outcome.empty(horizonStart, model.skippedKeys());
        }

        var graph = PrecedenceGraph.of(model.scheduleTasks());
        var allTasks = new HashMap<String, TaskDTO>();
        Stream.concat(tasks.stream(), anchors.stream()).forEach(task -> allTasks.put(task.taskKey(), task));
        for (var task : graph.tasks().values()) {
            if (task.fixed()) {
                continue;
            }
            for (var predecessorKey : task.predecessors()) {
                if (graph.task(predecessorKey) != null) {
                    continue;
                }
                var predecessor = allTasks.get(predecessorKey);
                if (predecessor == null || predecessor.status() == null
                        || !TERMINAL_STATUSES.contains(predecessor.status())) {
                    throw new ValidationException("Cannot optimize task " + task.key()
                            + ": a predecessor has no complete date range");
                }
            }
        }
        var horizon = ScheduleObjective.Horizon.of(graph.tasks().values(), minHorizonDays);

        var current = decoder.asPlanned(graph);
        var currentMetrics = ScheduleEvaluator.evaluate(current, graph, horizon, alpha, beta);

        var metricsByRule = new LinkedHashMap<PriorityRule, ScheduleMetrics>();
        Schedule best = null;
        ScheduleMetrics bestMetrics = null;
        ValidationException horizonFailure = null;

        for (var rule : SsgsDecoder.candidateRules()) {
            Schedule candidate;
            try {
                candidate = decoder.decode(graph, rule, horizon);
            } catch (ValidationException ex) {
                horizonFailure = ex;
                continue;
            }
            var metrics = ScheduleEvaluator.evaluate(candidate, graph, horizon, alpha, beta);
            metricsByRule.put(rule, metrics);
            if (bestMetrics == null
                    || metrics.feasible() && !bestMetrics.feasible()
                    || metrics.feasible() == bestMetrics.feasible()
                    && metrics.objectiveValue() < bestMetrics.objectiveValue()) {
                best = candidate;
                bestMetrics = metrics;
            }
        }
        if (best == null) {
            throw horizonFailure != null ? horizonFailure
                    : new ValidationException("Cannot generate a schedule within the configured horizon");
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
