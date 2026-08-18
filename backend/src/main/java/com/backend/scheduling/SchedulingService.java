package com.backend.scheduling;

import com.backend.config.AppProperties;
import com.backend.dtos.TaskDTO;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Runs the scheduling problem: build the model, decode it under several priority rules, and keep
 * the one with the lowest objective value.
 *
 * <p>Trying several rules is what makes the {@code alpha} / {@code beta} weights mean something.
 * A single-pass constructive heuristic produces the same schedule regardless of them, so they only
 * ever changed the number that was reported — the endpoint advertised a trade-off the
 * implementation could not deliver. Decoding is a few milliseconds even at two thousand tasks, so
 * evaluating the whole candidate set and taking {@code argmin Z} is close to free, and it turns the
 * weights into genuine selectors.
 *
 * <p>Deliberately not transactional and free of entities: it consumes DTOs and returns a value, so
 * the CPU-bound work does not sit inside a transaction holding a pooled database connection.
 */
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

    /**
     * @param tasks        the tasks being optimized
     * @param anchors      tasks outside that set which constrain it (cross-project predecessors,
     *                     or predecessors that have no dates of their own); treated as fixed
     * @param horizonStart day 0 of the model, normally today
     */
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
            // Strictly-better wins, so ties keep the earlier (more explainable) rule: MORCPSP is
            // evaluated first, and AS_PLANNED before the single-criterion rules.
            if (bestMetrics == null || metrics.objectiveValue() < bestMetrics.objectiveValue()) {
                best = candidate;
                bestMetrics = metrics;
            }
        }

        return new Outcome(horizonStart, graph, current, currentMetrics, best, bestMetrics,
                CriticalPathAnalyzer.criticalTaskKeys(graph), model.skippedKeys(),
                Map.copyOf(metricsByRule));
    }

    /** Critical-path flags for one project's tasks, independent of any optimization run. */
    public Set<String> criticalTaskKeys(List<TaskDTO> tasks, LocalDate horizonStart) {
        var model = ScheduleModel.build(tasks, List.of(), horizonStart);
        if (model.scheduleTasks().isEmpty()) {
            return Set.of();
        }
        return CriticalPathAnalyzer.criticalTaskKeys(PrecedenceGraph.of(model.scheduleTasks()));
    }

    /**
     * @param current        the plan as it stands today, placed on the shared axis; may be
     *                       resource-infeasible, which is the point of reporting its conflict count
     * @param chosen         the lowest-Z feasible schedule
     * @param metricsByRule  every rule's metrics, so a caller can explain why one was chosen
     */
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
