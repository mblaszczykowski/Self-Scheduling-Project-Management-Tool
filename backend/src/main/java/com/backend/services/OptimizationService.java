package com.backend.services;

import com.backend.config.AppProperties;
import com.backend.dtos.OptimizationMetricsDTO;
import com.backend.dtos.OptimizationResultDTO;
import com.backend.dtos.TaskDTO;
import com.backend.dtos.TaskScheduleSuggestionDTO;
import com.backend.exception.ValidationException;
import com.backend.requests.ApplyOptimizationRequest;
import com.backend.requests.OptimizationRequest;
import com.backend.scheduling.Placement;
import com.backend.scheduling.ScheduleMetrics;
import com.backend.scheduling.SchedulingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;

/**
 * Application service for schedule optimization: authorize, load, delegate to the scheduler,
 * translate day offsets back into dates, and persist an accepted result.
 */
@Service
public class OptimizationService {

    private static final Logger log = LoggerFactory.getLogger(OptimizationService.class);

    private final OptimizationInputLoader inputLoader;
    private final TaskService taskService;
    private final SchedulingService schedulingService;
    private final AppProperties.Optimization config;

    public OptimizationService(OptimizationInputLoader inputLoader,
                               TaskService taskService,
                               SchedulingService schedulingService,
                               AppProperties appProperties) {
        this.inputLoader = inputLoader;
        this.taskService = taskService;
        this.schedulingService = schedulingService;
        this.config = appProperties.getOptimization();
    }

    // ======================== Simulate ========================

    public OptimizationResultDTO simulate(OptimizationRequest request, Integer userId) {
        var alpha = request.alpha() != null ? request.alpha() : config.getDefaultAlpha();
        var beta = request.beta() != null ? request.beta() : config.getDefaultBeta();
        var horizonStart = resolveHorizonStart(request.horizonStart());

        var input = inputLoader.load(request.projectKeys(), userId);
        // The CPU-bound decode runs outside any transaction: the loader owns a read-only
        // transaction that has already closed, and the scheduler consumes DTOs only.
        var outcome = schedulingService.optimize(input.tasks(), input.anchors(), horizonStart, alpha, beta);

        if (outcome.isEmpty()) {
            var empty = new OptimizationMetricsDTO(0, 0, 0, 0, 0, 0, 0, true);
            return new OptimizationResultDTO(List.of(), empty, empty, 0,
                    null, outcome.skippedKeys());
        }

        var suggestions = buildSuggestions(input.tasks(), outcome);
        int shifted = (int) suggestions.stream().filter(TaskScheduleSuggestionDTO::wasShifted).count();

        return new OptimizationResultDTO(
                suggestions,
                toDto(outcome.currentMetrics()),
                toDto(outcome.chosenMetrics()),
                shifted,
                outcome.chosen().rule().label(),
                outcome.skippedKeys());
    }

    // ======================== Apply ========================

    /**
     * Re-derives the schedule server-side and persists it.
     *
     * <p>The endpoint takes the same inputs as the simulation rather than a list of dates echoed
     * back by the browser. That makes what lands in the database feasible by construction, removes
     * the need to trust client-supplied dates, and closes the window where a dependency edited
     * between simulate and apply would have been written as a silently infeasible plan.
     *
     * <p>Writes go through {@link TaskService#applySchedule} so the change appears in each task's
     * activity history and reaches its assignee — the previous direct {@code saveAll} left no trace
     * of how a task's dates got there.
     */
    public int apply(ApplyOptimizationRequest request, Integer userId) {
        var alpha = request.alpha() != null ? request.alpha() : config.getDefaultAlpha();
        var beta = request.beta() != null ? request.beta() : config.getDefaultBeta();
        var horizonStart = resolveHorizonStart(request.horizonStart());

        var input = inputLoader.load(request.projectKeys(), userId);
        var outcome = schedulingService.optimize(input.tasks(), input.anchors(), horizonStart, alpha, beta);
        if (outcome.isEmpty()) {
            return 0;
        }

        var accepted = request.acceptedTaskKeys() == null || request.acceptedTaskKeys().isEmpty()
                ? null
                : new HashSet<>(request.acceptedTaskKeys());

        var changes = new ArrayList<TaskService.ScheduleChange>();
        for (var dto : input.tasks()) {
            var placement = outcome.chosen().placements().get(dto.taskKey());
            if (placement == null) {
                continue;
            }
            var suggestedStart = horizonStart.plusDays(placement.start());
            var suggestedDue = suggestedDueDate(horizonStart, placement);
            if (suggestedStart.equals(dto.startDate()) && suggestedDue.equals(dto.dueDate())) {
                continue;
            }
            if (accepted != null && !accepted.contains(dto.taskKey())) {
                continue;
            }
            changes.add(new TaskService.ScheduleChange(dto.taskKey(), suggestedStart, suggestedDue));
        }

        if (changes.isEmpty()) {
            return 0;
        }
        log.info("Applying optimized schedule: {} task(s) across {} project(s) for user {}",
                changes.size(), request.projectKeys().size(), userId);
        return taskService.applySchedule(changes, userId);
    }

    // ======================== Internals ========================

    /**
     * Bounds a caller-supplied horizon. Without this, a simulation could be asked to start in the
     * year 1000 and would happily return (and let the client persist) dates from that year.
     */
    private LocalDate resolveHorizonStart(LocalDate requested) {
        var today = LocalDate.now();
        if (requested == null) {
            return today;
        }
        var earliest = today.minusDays(config.getHorizonStartMaxPastDays());
        var latest = today.plusDays(config.getHorizonStartMaxFutureDays());
        if (requested.isBefore(earliest) || requested.isAfter(latest)) {
            throw new ValidationException("horizonStart must be between " + earliest + " and " + latest);
        }
        return requested;
    }

    private List<TaskScheduleSuggestionDTO> buildSuggestions(List<TaskDTO> taskDTOs,
                                                             SchedulingService.Outcome outcome) {
        var horizonStart = outcome.horizonStart();
        var critical = outcome.criticalKeys();
        var suggestions = new ArrayList<TaskScheduleSuggestionDTO>(taskDTOs.size());

        for (var dto : taskDTOs) {
            var placement = outcome.chosen().placements().get(dto.taskKey());
            if (placement == null) {
                continue;
            }
            var scheduleTask = outcome.graph().task(dto.taskKey());
            if (scheduleTask == null || scheduleTask.fixed()) {
                continue;
            }

            var suggestedStart = horizonStart.plusDays(placement.start());
            var suggestedDue = suggestedDueDate(horizonStart, placement);
            boolean wasShifted = !suggestedStart.equals(dto.startDate())
                    || !suggestedDue.equals(dto.dueDate());

            suggestions.add(new TaskScheduleSuggestionDTO(
                    dto.taskKey(),
                    dto.projectKey(),
                    dto.summary(),
                    dto.assignee(),
                    dto.startDate(),
                    dto.dueDate(),
                    suggestedStart,
                    suggestedDue,
                    scheduleTask.priorityWeight(),
                    placement.tardiness(),
                    critical.contains(dto.taskKey()),
                    wasShifted));
        }
        return suggestions;
    }

    /** {@code end} is exclusive, and a due date is inclusive, so the last worked day is end - 1. */
    private static LocalDate suggestedDueDate(LocalDate horizonStart, Placement placement) {
        return horizonStart.plusDays(Math.max(placement.end() - 1, placement.start()));
    }

    private static OptimizationMetricsDTO toDto(ScheduleMetrics metrics) {
        return new OptimizationMetricsDTO(
                metrics.weightedTardiness(),
                metrics.makespan(),
                metrics.objectiveValue(),
                metrics.totalTasks(),
                metrics.tasksOnTime(),
                metrics.tasksLate(),
                metrics.resourceConflicts(),
                metrics.feasible());
    }

    /** Unused placeholder kept out; see TaskKey for key parsing. */
}
