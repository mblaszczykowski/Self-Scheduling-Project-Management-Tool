package com.backend.services;

import com.backend.dtos.TaskDTO;
import com.backend.entities.Project;
import com.backend.entities.Task;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.mapper.EntityMapper;
import com.backend.repositories.ProjectRepository;
import com.backend.repositories.TaskRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;

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
    private final EntityManager entityManager;

    public OptimizationInputLoader(ProjectRepository projectRepository,
                                   TaskRepository taskRepository,
                                   EntityMapper entityMapper,
                                   EntityManager entityManager) {
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
        this.entityMapper = entityMapper;
        this.entityManager = entityManager;
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
        if (taskRepository.countByProjectIdIn(projectIds) > 5000) {
            throw new ValidationException("At most 5000 tasks can be optimized at once");
        }
        var tasks = taskRepository.findByProjectIdsWithDetails(projectIds).stream().distinct().toList();
        if (isApplying()) {
            projects.forEach(project -> entityManager.lock(project, LockModeType.OPTIMISTIC_FORCE_INCREMENT));
            tasks.forEach(task -> entityManager.lock(task, LockModeType.OPTIMISTIC_FORCE_INCREMENT));
        }
        var taskDTOs = tasks.stream().map(task -> entityMapper.toTaskDTO(task, null)).toList();

        return new Input(taskDTOs, loadOutsideAnchors(taskDTOs, tasks, userId));
    }

    private List<TaskDTO> loadOutsideAnchors(List<TaskDTO> taskDTOs, List<Task> tasks, Integer userId) {
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
        if ((long) tasks.size() + idsByKey.size() > 5000) {
            throw new ValidationException("At most 5000 tasks including dependencies can be optimized at once");
        }
        var anchors = taskRepository.findAllByIdInWithDetails(new ArrayList<>(idsByKey.values()));
        if (anchors.stream().anyMatch(task -> !task.getProject().hasAccess(userId))) {
            throw new ResourceNotFoundException("One or more dependency projects not found");
        }
        if (isApplying()) {
            anchors.forEach(task -> {
                entityManager.lock(task, LockModeType.OPTIMISTIC_FORCE_INCREMENT);
                entityManager.lock(task.getProject(), LockModeType.OPTIMISTIC_FORCE_INCREMENT);
            });
        }
        return anchors.stream()
                .map(task -> entityMapper.toTaskDTO(task, null))
                .toList();
    }

    private static boolean isApplying() {
        return TransactionSynchronizationManager.isActualTransactionActive()
                && !TransactionSynchronizationManager.isCurrentTransactionReadOnly();
    }
}
