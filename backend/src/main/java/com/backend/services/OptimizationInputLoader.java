package com.backend.services;

import com.backend.dtos.TaskDTO;
import com.backend.entities.Project;
import com.backend.entities.Task;
import com.backend.exception.ResourceNotFoundException;
import com.backend.mapper.EntityMapper;
import com.backend.repositories.ProjectRepository;
import com.backend.repositories.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class OptimizationInputLoader {
    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final EntityMapper entityMapper;

    public OptimizationInputLoader(ProjectRepository projectRepository,
                                   TaskRepository taskRepository,
                                   EntityMapper entityMapper) {
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
        this.entityMapper = entityMapper;
    }

    public record Input(List<TaskDTO> tasks, List<TaskDTO> anchors) {}

    @Transactional(readOnly = true)
    public Input load(List<String> projectKeys, Integer userId) {
        var distinctKeys = projectKeys.stream().distinct().toList();
        var projects = projectRepository.findByProjectKeyIn(distinctKeys);
        if (projects.size() != distinctKeys.size()) {
            throw new ResourceNotFoundException("One or more projects not found");
        }
        for (var project : projects) {
            if (!project.hasAccess(userId)) {
                throw new ResourceNotFoundException("One or more projects not found");
            }
        }

        var projectIds = projects.stream().map(Project::getId).toList();
        var tasks = taskRepository.findByProjectIdsWithDetails(projectIds).stream().distinct().toList();
        var taskDTOs = tasks.stream().map(task -> entityMapper.toTaskDTO(task, null)).toList();

        return new Input(taskDTOs, loadOutsideAnchors(taskDTOs, tasks));
    }

    private List<TaskDTO> loadOutsideAnchors(List<TaskDTO> taskDTOs, List<Task> tasks) {
        var known = taskDTOs.stream().map(TaskDTO::taskKey).collect(Collectors.toSet());
        var missing = new LinkedHashSet<String>();
        for (var dto : taskDTOs) {
            for (var dependency : dto.dependencyKeys()) {
                if (!known.contains(dependency)) {
                    missing.add(dependency);
                }
            }
        }
        if (missing.isEmpty()) {
            return List.of();
        }

        var idsByKey = new HashMap<String, Integer>();
        for (var task : tasks) {
            for (var dependency : task.getDependencies()) {
                if (missing.contains(dependency.getTaskKey())) {
                    idsByKey.put(dependency.getTaskKey(), dependency.getId());
                }
            }
        }
        if (idsByKey.isEmpty()) {
            return List.of();
        }
        return taskRepository.findAllByIdInWithDetails(new ArrayList<>(idsByKey.values())).stream()
                .map(task -> entityMapper.toTaskDTO(task, null))
                .toList();
    }
}
