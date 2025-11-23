package com.backend.services;

import com.backend.dtos.TaskDTO;

import java.util.*;
import java.util.stream.Collectors;

public class CriticalPathMethodHelper {
    public List<TaskDTO> calculateTaskDTOsWithCPM(List<TaskDTO> tasks) {
        Map<Integer, TaskCPM> taskGraph = buildTaskGraph(tasks);
        performCPM(taskGraph);
        return tasks.stream()
                .map(t -> updateTaskDTOWithIsCritical(t, taskGraph.get(t.id())))
                .collect(Collectors.toList());
    }

    private Map<Integer, TaskCPM> buildTaskGraph(List<TaskDTO> tasks) {
        Map<Integer, TaskCPM> taskMap = new HashMap<>();
        for (TaskDTO task : tasks) {
            int duration = calculateTaskDuration(task.startDate(), task.dueDate());
            TaskCPM taskCPM = new TaskCPM(task.id(), duration, task.dependencies());
            taskMap.put(task.id(), taskCPM);
        }
        for (TaskCPM task : taskMap.values()) {
            for (Integer depId : task.dependencies) {
                TaskCPM depTask = taskMap.get(depId);
                if (depTask != null) {
                    depTask.successors.add(task.id);
                }
            }
        }
        return taskMap;
    }

    private void performCPM(Map<Integer, TaskCPM> taskMap) {
        forwardPass(taskMap);
        backwardPass(taskMap);
    }

    private void forwardPass(Map<Integer, TaskCPM> taskMap) {
        Set<Integer> visited = new HashSet<>();
        for (TaskCPM task : taskMap.values()) {
            calculateEarliestTimes(task, taskMap, visited);
        }
    }

    private void calculateEarliestTimes(TaskCPM task, Map<Integer, TaskCPM> taskMap, Set<Integer> visited) {
        if (visited.contains(task.id)) return;
        visited.add(task.id);
        if (!task.dependencies.isEmpty()) {
            int maxEarliestFinish = 0;
            for (Integer depId : task.dependencies) {
                TaskCPM depTask = taskMap.get(depId);
                if (depTask != null) {
                    calculateEarliestTimes(depTask, taskMap, visited);
                    if (depTask.earliestFinish > maxEarliestFinish) {
                        maxEarliestFinish = depTask.earliestFinish;
                    }
                }
            }
            task.earliestStart = maxEarliestFinish;
        }
        task.earliestFinish = task.earliestStart + task.duration;
    }

    private void backwardPass(Map<Integer, TaskCPM> taskMap) {
        int projectFinish = taskMap.values().stream()
                .mapToInt(t -> t.earliestFinish)
                .max()
                .orElse(0);
        for (TaskCPM task : taskMap.values()) {
            if (task.successors.isEmpty()) {
                task.latestFinish = projectFinish;
            }
        }
        for (TaskCPM task : taskMap.values()) {
            if (task.successors.isEmpty()) {
                calculateLatestTimes(task, taskMap);
            }
        }
    }

    private void calculateLatestTimes(TaskCPM task, Map<Integer, TaskCPM> taskMap) {
        task.latestStart = task.latestFinish - task.duration;
        task.totalFloat = task.latestStart - task.earliestStart;
        task.isCritical = task.totalFloat == 0;
        for (Integer depId : task.dependencies) {
            TaskCPM depTask = taskMap.get(depId);
            if (depTask != null && depTask.latestFinish > task.latestStart) {
                depTask.latestFinish = task.latestStart;
                calculateLatestTimes(depTask, taskMap);
            }
        }
    }

    private int calculateTaskDuration(Date startDate, Date dueDate) {
        long diffInMillis = dueDate.getTime() - startDate.getTime();
        return (int) (diffInMillis / (1000L * 60L * 60L * 24L)) + 1;
    }

    private TaskDTO updateTaskDTOWithIsCritical(TaskDTO taskDTO, TaskCPM taskCPM) {
        return new TaskDTO(
                taskDTO.id(),
                taskDTO.projectKey(),
                taskDTO.taskKey(),
                taskDTO.summary(),
                taskDTO.description(),
                taskDTO.status(),
                taskDTO.startDate(),
                taskDTO.dueDate(),
                taskDTO.assignee(),
                taskDTO.labels(),
                taskDTO.dependencies(),
                taskCPM.isCritical,
                taskDTO.attachments(),
                taskDTO.created(),
                taskDTO.updated(),
                taskDTO.progress(),
                taskDTO.priority()
        );
    }

    private static class TaskCPM {
        Integer id;
        Integer duration;
        List<Integer> dependencies;
        List<Integer> successors = new ArrayList<>();
        Integer earliestStart = 0;
        Integer earliestFinish = 0;
        Integer latestStart = Integer.MAX_VALUE;
        Integer latestFinish = Integer.MAX_VALUE;
        Integer totalFloat = 0;
        Boolean isCritical = false;

        TaskCPM(Integer id, Integer duration, List<Integer> dependencies) {
            this.id = id;
            this.duration = duration;
            this.dependencies = dependencies != null ? dependencies : new ArrayList<>();
        }
    }
}
