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
    private final CriticalPathMethodHelper cpmHelper = new CriticalPathMethodHelper();
    private final ScheduleOptimizer optimizer = new ScheduleOptimizer();

    public OptimizationService(ProjectRepository projectRepository, TaskRepository taskRepository,
                               TaskService taskService) {
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
        this.taskService = taskService;
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

        // Fetch and authorize projects
        var projects = projectKeys.stream()
                .map(key -> projectRepository.findByProjectKey(key)
                        .orElseThrow(() -> new ResourceNotFoundException("Project not found: " + key)))
                .toList();

        for (var project : projects) {
            if (!project.hasAccess(userId)) {
                throw new AuthorizationException("No access to project: " + project.getProjectKey());
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
            // Use the earliest task start date as horizon, so past tasks are
            // optimized in their actual time frame rather than being pushed to today
            horizonStart = taskDTOs.stream()
                    .filter(t -> t.startDate() != null)
                    .map(TaskDTO::startDate)
                    .min(LocalDate::compareTo)
                    .orElse(LocalDate.now());
        }

        // Run evaluation on current schedule and optimization
        var originalResult = optimizer.evaluateOriginal(taskDTOs, horizonStart, alpha, beta);
        var optimizedResult = optimizer.optimize(taskDTOs, horizonStart, alpha, beta);

        // Build suggestions
        var suggestions = buildSuggestions(taskDTOs, optimizedResult, criticalSet);

        // Count late tasks from results
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
                optimizedResult.tasksShifted());
    }

    @Transactional
    public void applyOptimization(List<TaskScheduleSuggestionDTO> suggestions, Integer userId) {
        if (suggestions == null || suggestions.isEmpty()) return;

        // Filter to only shifted tasks
        var shiftedSuggestions = suggestions.stream()
                .filter(TaskScheduleSuggestionDTO::wasShifted)
                .toList();

        if (shiftedSuggestions.isEmpty()) return;

        // Batch fetch all tasks we need to update
        for (var suggestion : shiftedSuggestions) {
            var task = taskRepository.findByTaskKey(suggestion.taskKey())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Task not found: " + suggestion.taskKey()));

            if (!task.getProject().hasAccess(userId)) {
                throw new AuthorizationException("No access to task: " + suggestion.taskKey());
            }

            task.setStartDate(suggestion.suggestedStartDate());
            task.setDueDate(suggestion.suggestedDueDate());
            taskRepository.save(task);
        }
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

            int priorityWeight = dto.priority() != null ? mapPriorityToWeight(dto.priority()) : 5;

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

    private int mapPriorityToWeight(com.backend.entities.TaskPriority priority) {
        return switch (priority) {
            case LOWEST -> 1;
            case LOW -> 3;
            case MEDIUM -> 5;
            case HIGH -> 8;
            case HIGHEST -> 10;
        };
    }
}
