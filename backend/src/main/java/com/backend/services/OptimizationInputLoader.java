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

/**
 * Loads and authorizes the tasks a schedule optimization will work on, and returns DTOs.
 *
 * <p>A separate bean so the read transaction opens and closes here: the decode itself is CPU-bound
 * and must not run while holding a pooled database connection. Keeping it in the same class would
 * have made the {@code @Transactional} boundary a self-invocation, which the proxy never applies.
 */
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

    /**
     * @param tasks   the tasks of the requested projects
     * @param anchors predecessors that live outside those projects. A dependency whose task was not
     *                loaded contributed no constraint at all, so optimizing one project could
     *                silently produce a schedule that violated a cross-project dependency.
     */
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
                // Same message as a genuinely missing project, so this is not an existence oracle.
                throw new ResourceNotFoundException("Project not found");
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

        // The dependency entities are already loaded on the tasks, so their ids are available
        // without another lookup per key.
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
