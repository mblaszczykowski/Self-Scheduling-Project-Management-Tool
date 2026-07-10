package com.backend.services;

import com.backend.dtos.*;
import com.backend.entities.Task;
import com.backend.exception.AuthorizationException;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.repositories.ProjectRepository;
import com.backend.repositories.TaskRepository;
import com.backend.util.CriticalPathMethodHelper;
import com.backend.util.ScheduleOptimizer;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class OptimizationService {

    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final TaskService taskService;
    private final CriticalPathMethodHelper cpmHelper;
    private final ScheduleOptimizer optimizer = new ScheduleOptimizer();

    public OptimizationService(ProjectRepository projectRepository, TaskRepository taskRepository,
                               TaskService taskService, CriticalPathMethodHelper cpmHelper) {
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
        this.taskService = taskService;
        this.cpmHelper = cpmHelper;
    }

    @Transactional(readOnly = true)
    public OptimizationResultDTO optimizeSchedule(List<String> projectKeys, Integer userId,
                                                   double alpha, double beta, LocalDate horizonStart) {
        if (projectKeys == null || projectKeys.isEmpty()) {
            throw new ValidationException("At least one project key is required");
        }
        if (alpha < 0 || alpha > 1 || beta < 0 || beta > 1) {
            throw new ValidationException("Alpha and beta must be between 0 and 1");
        }

        // Fetch and authorize projects (batch)
        var projects = projectRepository.findByProjectKeyIn(projectKeys);
        if (projects.size() != projectKeys.size()) {
            throw new ResourceNotFoundException("One or more projects not found");
        }
        for (var project : projects) {
            if (!project.hasAccess(userId)) {
                throw new ResourceNotFoundException("Project not found");
            }
        }

        // Fetch all tasks with details in one query
        var projectIds = projects.stream().map(p -> p.getId()).toList();
        List<Task> tasks = taskRepository.findByProjectIdsWithDetails(projectIds);

        // Convert to DTOs and enrich with CPM
        List<TaskDTO> taskDTOs = tasks.stream()
                .map(taskService::convertToDTO)
                .toList();
        taskDTOs = cpmHelper.calculateTaskDTOsWithCPM(taskDTOs);

        // Build critical path set for later enrichment
        var criticalSet = taskDTOs.stream()
                .filter(t -> Boolean.TRUE.equals(t.isCritical()))
                .map(TaskDTO::taskKey)
                .collect(Collectors.toSet());

        if (horizonStart == null) {
            // T_0 = today (start of re-optimization). Tasks completed before T_0
            // get negative offsets but their original dates are preserved as
            // fixed precedence constraints. Active tasks satisfy S_j >= 0,
            // i.e. they cannot be scheduled into the past.
            horizonStart = LocalDate.now();
        }

        // Evaluate the current schedule, then run a single SSGS pass.
        // SSGS is a deterministic single-pass constructive heuristic: given the priority
        // rule the schedule is fully determined, and alpha/beta only weigh the reported
        // objective Z (they do not influence the generated schedule), so no iterative
        // re-optimization is required. Metrics are always scored against the original
        // due dates so "before" and "after" are directly comparable.
        var originalResult = optimizer.evaluateOriginal(taskDTOs, horizonStart, alpha, beta);
        var optimizedResult = optimizer.optimize(taskDTOs, horizonStart, alpha, beta);

        // Build suggestions comparing original dates vs optimized positions
        var suggestions = buildSuggestions(taskDTOs, optimizedResult, criticalSet);

        // Compute total tasks shifted relative to ORIGINAL dates (not last iteration)
        int totalTasksShifted = (int) suggestions.stream()
                .filter(TaskScheduleSuggestionDTO::wasShifted)
                .count();

        // Count late tasks from results (both use original taskDTOs for consistent comparison)
        int originalTasksLate = countLateTasks(taskDTOs, originalResult);
        int optimizedTasksLate = countLateTasks(taskDTOs, optimizedResult);
        int totalActiveTasks = optimizedResult.tasks().size();

        var originalMetrics = new OptimizationMetricsDTO(
                originalResult.weightedTardiness(),
                originalResult.makespan(),
                originalResult.objectiveValue(),
                totalActiveTasks,
                totalActiveTasks - originalTasksLate,
                originalTasksLate,
                originalResult.resourceConflicts()
        );

        var optimizedMetrics = new OptimizationMetricsDTO(
                optimizedResult.weightedTardiness(),
                optimizedResult.makespan(),
                optimizedResult.objectiveValue(),
                totalActiveTasks,
                totalActiveTasks - optimizedTasksLate,
                optimizedTasksLate,
                optimizedResult.resourceConflicts() // should be 0 after SSGS
        );

        return new OptimizationResultDTO(suggestions, originalMetrics, optimizedMetrics,
                totalTasksShifted);
    }

    @Transactional(rollbackFor = Exception.class)
    public void applyOptimization(List<TaskScheduleSuggestionDTO> suggestions, Integer userId) {
        if (suggestions == null || suggestions.isEmpty()) return;

        // Filter to only shifted tasks
        var shiftedSuggestions = suggestions.stream()
                .filter(TaskScheduleSuggestionDTO::wasShifted)
                .toList();

        if (shiftedSuggestions.isEmpty()) return;

        // Collect all task keys and batch-fetch
        var tasksByProjectKey = new HashMap<String, List<Integer>>();
        for (var s : shiftedSuggestions) {
            var key = s.taskKey();
            if (key == null || !key.contains("-")) continue;
            var lastDash = key.lastIndexOf('-');
            var projectKey = key.substring(0, lastDash);
            try {
                var taskNumber = Integer.parseInt(key.substring(lastDash + 1));
                tasksByProjectKey.computeIfAbsent(projectKey, k -> new ArrayList<>()).add(taskNumber);
            } catch (NumberFormatException ignored) {}
        }

        var allTasks = new ArrayList<Task>();
        for (var entry : tasksByProjectKey.entrySet()) {
            allTasks.addAll(taskRepository.findByProjectKeyAndTaskNumbers(entry.getKey(), entry.getValue()));
        }
        var taskMap = allTasks.stream().collect(Collectors.toMap(Task::getTaskKey, t -> t));

        // Now iterate suggestions using the map
        var tasksToSave = new ArrayList<Task>();
        for (var s : shiftedSuggestions) {
            var task = taskMap.get(s.taskKey());
            if (task == null) {
                throw new ResourceNotFoundException("Task not found: " + s.taskKey());
            }
            if (!task.getProject().hasAccess(userId)) {
                throw new AuthorizationException("No access to task: " + s.taskKey());
            }
            task.setStartDate(s.suggestedStartDate());
            task.setDueDate(s.suggestedDueDate());
            tasksToSave.add(task);
        }
        taskRepository.saveAll(tasksToSave);
    }

    private int countLateTasks(List<TaskDTO> taskDTOs, ScheduleOptimizer.ScheduleResult result) {
        int count = 0;
        for (var dto : taskDTOs) {
            var scheduled = result.tasks().get(dto.taskKey());
            if (scheduled != null && scheduled.tardinessDays() > 0) count++;
        }
        return count;
    }

    private List<TaskScheduleSuggestionDTO> buildSuggestions(
            List<TaskDTO> taskDTOs,
            ScheduleOptimizer.ScheduleResult result,
            Set<String> criticalTasks
    ) {
        var suggestions = new ArrayList<TaskScheduleSuggestionDTO>();

        for (var dto : taskDTOs) {
            var scheduled = result.tasks().get(dto.taskKey());
            if (scheduled == null) continue;

            boolean wasShifted = !scheduled.suggestedStart().equals(dto.startDate())
                    || !scheduled.suggestedDue().equals(dto.dueDate());

            int priorityWeight = dto.priority() != null ? ScheduleOptimizer.mapPriorityToWeight(dto.priority()) : 5;

            suggestions.add(new TaskScheduleSuggestionDTO(
                    dto.taskKey(),
                    dto.projectKey(),
                    dto.summary(),
                    dto.assignee(),
                    dto.startDate(),
                    dto.dueDate(),
                    scheduled.suggestedStart(),
                    scheduled.suggestedDue(),
                    priorityWeight,
                    scheduled.tardinessDays(),
                    criticalTasks.contains(dto.taskKey()),
                    wasShifted
            ));
        }

        return suggestions;
    }

}
