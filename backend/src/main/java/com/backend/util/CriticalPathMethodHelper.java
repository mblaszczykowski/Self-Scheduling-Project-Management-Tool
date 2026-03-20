package com.backend.util;

import com.backend.dtos.TaskDTO;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Component
public class CriticalPathMethodHelper {

    public List<TaskDTO> calculateTaskDTOsWithCPM(List<TaskDTO> tasks) {
        if (tasks == null || tasks.isEmpty()) {
            return tasks;
        }

        var validTasks = tasks.stream()
                .filter(t -> t.startDate() != null && t.dueDate() != null)
                .toList();

        if (validTasks.isEmpty()) {
            return tasks;
        }

        var taskGraph = buildTaskGraph(validTasks);
        performCPM(taskGraph);

        var criticalMap = taskGraph.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().isCritical));

        return tasks.stream()
                .map(t -> updateTaskDTOWithIsCritical(t, criticalMap.getOrDefault(t.taskKey(), false)))
                .toList();
    }

    private Map<String, TaskCPM> buildTaskGraph(List<TaskDTO> tasks) {
        var taskMap = new HashMap<String, TaskCPM>();

        for (var task : tasks) {
            var duration = calculateTaskDuration(task.startDate(), task.dueDate());
            var deps = task.dependencyKeys() != null ? task.dependencyKeys() : new ArrayList<String>();
            var taskCPM = new TaskCPM(task.taskKey(), duration, deps);
            taskMap.put(task.taskKey(), taskCPM);
        }

        for (var task : taskMap.values()) {
            for (var depKey : task.dependencies) {
                var depTask = taskMap.get(depKey);
                if (depTask != null) {
                    depTask.successors.add(task.taskKey);
                }
            }
        }

        return taskMap;
    }

    private void performCPM(Map<String, TaskCPM> taskMap) {
        forwardPass(taskMap);
        backwardPass(taskMap);
    }

    private void forwardPass(Map<String, TaskCPM> taskMap) {
        var visited = new HashSet<String>();
        for (var task : taskMap.values()) {
            calculateEarliestTimes(task, taskMap, visited);
        }
    }

    private void calculateEarliestTimes(TaskCPM task, Map<String, TaskCPM> taskMap, Set<String> visited) {
        if (visited.contains(task.taskKey)) return;
        visited.add(task.taskKey);

        if (!task.dependencies.isEmpty()) {
            var maxEarliestFinish = 0;
            for (var depKey : task.dependencies) {
                var depTask = taskMap.get(depKey);
                if (depTask != null) {
                    calculateEarliestTimes(depTask, taskMap, visited);
                    maxEarliestFinish = Math.max(maxEarliestFinish, depTask.earliestFinish);
                }
            }
            task.earliestStart = maxEarliestFinish;
        }
        task.earliestFinish = task.earliestStart + task.duration;
    }

    private void backwardPass(Map<String, TaskCPM> taskMap) {
        var projectFinish = taskMap.values().stream()
                .mapToInt(t -> t.earliestFinish)
                .max()
                .orElse(0);

        var topoOrder = topologicalSort(taskMap);

        for (int i = topoOrder.size() - 1; i >= 0; i--) {
            var task = taskMap.get(topoOrder.get(i));
            if (task.successors.isEmpty()) {
                task.latestFinish = projectFinish;
            } else {
                task.latestFinish = task.successors.stream()
                        .map(taskMap::get)
                        .filter(Objects::nonNull)
                        .mapToInt(s -> s.latestStart)
                        .min()
                        .orElse(projectFinish);
            }
            task.latestStart = task.latestFinish - task.duration;
            task.totalFloat = task.latestStart - task.earliestStart;
            task.isCritical = task.totalFloat == 0;
        }
    }

    private List<String> topologicalSort(Map<String, TaskCPM> taskMap) {
        var order = new ArrayList<String>();
        var visited = new HashSet<String>();
        for (var task : taskMap.values()) {
            topologicalSortDFS(task, taskMap, visited, order);
        }
        return order;
    }

    private void topologicalSortDFS(TaskCPM task, Map<String, TaskCPM> taskMap,
                                     Set<String> visited, List<String> order) {
        if (visited.contains(task.taskKey)) return;
        visited.add(task.taskKey);
        for (var depKey : task.dependencies) {
            var depTask = taskMap.get(depKey);
            if (depTask != null) {
                topologicalSortDFS(depTask, taskMap, visited, order);
            }
        }
        order.add(task.taskKey);
    }

    private int calculateTaskDuration(LocalDate startDate, LocalDate dueDate) {
        if (startDate == null || dueDate == null) {
            return 1;
        }
        var days = ChronoUnit.DAYS.between(startDate, dueDate);
        return Math.max(1, (int) days + 1);
    }

    private TaskDTO updateTaskDTOWithIsCritical(TaskDTO taskDTO, Boolean isCritical) {
        return new TaskDTO(
                taskDTO.id(),
                taskDTO.taskNumber(),
                taskDTO.taskKey(),
                taskDTO.projectKey(),
                taskDTO.summary(),
                taskDTO.description(),
                taskDTO.status(),
                taskDTO.startDate(),
                taskDTO.dueDate(),
                taskDTO.assignee(),
                taskDTO.labels(),
                taskDTO.dependencyKeys(),
                isCritical,
                taskDTO.attachments(),
                taskDTO.created(),
                taskDTO.updated(),
                taskDTO.progress(),
                taskDTO.priority()
        );
    }

    private static class TaskCPM {
        String taskKey;
        int duration;
        List<String> dependencies;
        List<String> successors = new ArrayList<>();
        int earliestStart = 0;
        int earliestFinish = 0;
        int latestStart = Integer.MAX_VALUE;
        int latestFinish = Integer.MAX_VALUE;
        int totalFloat = 0;
        boolean isCritical = false;

        TaskCPM(String taskKey, int duration, List<String> dependencies) {
            this.taskKey = taskKey;
            this.duration = duration;
            this.dependencies = dependencies != null ? dependencies : new ArrayList<>();
        }
    }
}
