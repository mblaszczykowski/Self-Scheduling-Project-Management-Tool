package com.backend.services;

import com.backend.dtos.TaskDTO;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

public class CriticalPathMethodHelper {

    public List<TaskDTO> calculateTaskDTOsWithCPM(List<TaskDTO> tasks) {
        if (tasks == null || tasks.isEmpty()) {
            return tasks;
        }

        List<TaskDTO> validTasks = tasks.stream()
                .filter(t -> t.startDate() != null && t.dueDate() != null)
                .collect(Collectors.toList());

        if (validTasks.isEmpty()) {
            return tasks;
        }

        Map<String, TaskCPM> taskGraph = buildTaskGraph(validTasks);
        performCPM(taskGraph);

        Map<String, Boolean> criticalMap = taskGraph.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().isCritical));

        return tasks.stream()
                .map(t -> updateTaskDTOWithIsCritical(t, criticalMap.getOrDefault(t.taskKey(), false)))
                .collect(Collectors.toList());
    }

    private Map<String, TaskCPM> buildTaskGraph(List<TaskDTO> tasks) {
        Map<String, TaskCPM> taskMap = new HashMap<>();

        for (TaskDTO task : tasks) {
            int duration = calculateTaskDuration(task.startDate(), task.dueDate());
            List<String> deps = task.dependencyKeys() != null ? task.dependencyKeys() : new ArrayList<>();
            TaskCPM taskCPM = new TaskCPM(task.taskKey(), duration, deps);
            taskMap.put(task.taskKey(), taskCPM);
        }

        for (TaskCPM task : taskMap.values()) {
            for (String depKey : task.dependencies) {
                TaskCPM depTask = taskMap.get(depKey);
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
        Set<String> visited = new HashSet<>();
        for (TaskCPM task : taskMap.values()) {
            calculateEarliestTimes(task, taskMap, visited);
        }
    }

    private void calculateEarliestTimes(TaskCPM task, Map<String, TaskCPM> taskMap, Set<String> visited) {
        if (visited.contains(task.taskKey)) return;
        visited.add(task.taskKey);

        if (!task.dependencies.isEmpty()) {
            int maxEarliestFinish = 0;
            for (String depKey : task.dependencies) {
                TaskCPM depTask = taskMap.get(depKey);
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
        int projectFinish = taskMap.values().stream()
                .mapToInt(t -> t.earliestFinish)
                .max()
                .orElse(0);

        for (TaskCPM task : taskMap.values()) {
            if (task.successors.isEmpty()) {
                task.latestFinish = projectFinish;
            }
        }

        Set<String> visited = new HashSet<>();
        for (TaskCPM task : taskMap.values()) {
            if (task.successors.isEmpty()) {
                calculateLatestTimes(task, taskMap, visited);
            }
        }
    }

    private void calculateLatestTimes(TaskCPM task, Map<String, TaskCPM> taskMap, Set<String> visited) {
        if (visited.contains(task.taskKey)) return;
        visited.add(task.taskKey);

        task.latestStart = task.latestFinish - task.duration;
        task.totalFloat = task.latestStart - task.earliestStart;
        task.isCritical = task.totalFloat == 0;

        for (String depKey : task.dependencies) {
            TaskCPM depTask = taskMap.get(depKey);
            if (depTask != null) {
                if (depTask.latestFinish > task.latestStart) {
                    depTask.latestFinish = task.latestStart;
                }
                calculateLatestTimes(depTask, taskMap, visited);
            }
        }
    }

    private int calculateTaskDuration(LocalDate startDate, LocalDate dueDate) {
        if (startDate == null || dueDate == null) {
            return 1;
        }
        long days = ChronoUnit.DAYS.between(startDate, dueDate);
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