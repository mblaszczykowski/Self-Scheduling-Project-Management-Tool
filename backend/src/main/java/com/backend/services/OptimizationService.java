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

    public OptimizationResultDTO simulate(OptimizationRequest request, Integer userId) {
        var run = derive(request.projectKeys(), request.alpha(), request.beta(),
                request.horizonStart(), userId);
        var input = run.input();
        var outcome = run.outcome();

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

    public int apply(ApplyOptimizationRequest request, Integer userId) {
        var run = derive(request.projectKeys(), request.alpha(), request.beta(),
                request.horizonStart(), userId);
        var input = run.input();
        var outcome = run.outcome();
        var horizonStart = run.horizonStart();
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
            var dates = suggestedDatesFor(dto, horizonStart, placement);
            if (!dates.changed()) {
                continue;
            }
            if (accepted != null && !accepted.contains(dto.taskKey())) {
                throw new ValidationException(
                        "The schedule has changed since it was previewed. Re-run the optimization "
                                + "to review the current plan before applying it.");
            }
            changes.add(new TaskService.ScheduleChange(dto.taskKey(), dates.start(), dates.due()));
        }

        if (changes.isEmpty()) {
            return 0;
        }
        log.info("Applying optimized schedule: {} task(s) across {} project(s) for user {}",
                changes.size(), request.projectKeys().size(), userId);
        return taskService.applySchedule(changes, userId);
    }

    private record Run(OptimizationInputLoader.Input input, SchedulingService.Outcome outcome,
                       LocalDate horizonStart) {}

    private Run derive(List<String> projectKeys, Double requestedAlpha, Double requestedBeta,
                       LocalDate requestedHorizonStart, Integer userId) {
        var alpha = requestedAlpha != null ? requestedAlpha : config.getDefaultAlpha();
        var beta = requestedBeta != null ? requestedBeta : config.getDefaultBeta();
        var horizonStart = resolveHorizonStart(requestedHorizonStart);
        var input = inputLoader.load(projectKeys, userId);
        return new Run(input,
                schedulingService.optimize(input.tasks(), input.anchors(), horizonStart, alpha, beta),
                horizonStart);
    }

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

            var dates = suggestedDatesFor(dto, horizonStart, placement);

            suggestions.add(new TaskScheduleSuggestionDTO(
                    dto.taskKey(),
                    dto.projectKey(),
                    dto.summary(),
                    dto.assignee(),
                    dto.startDate(),
                    dto.dueDate(),
                    dates.start(),
                    dates.due(),
                    scheduleTask.priorityWeight(),
                    placement.tardiness(),
                    critical.contains(dto.taskKey()),
                    dates.changed()));
        }
        return suggestions;
    }

    private record SuggestedDates(LocalDate start, LocalDate due, boolean changed) {}

    private static SuggestedDates suggestedDatesFor(TaskDTO dto, LocalDate horizonStart, Placement placement) {
        var start = horizonStart.plusDays(placement.start());
        var due = suggestedDueDate(horizonStart, placement);
        boolean changed = !start.equals(dto.startDate()) || !due.equals(dto.dueDate());
        return new SuggestedDates(start, due, changed);
    }

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
}
