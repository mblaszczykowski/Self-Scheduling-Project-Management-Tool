package com.backend.daos;

import com.backend.entities.Task;
import com.backend.entities.TaskStatus;
import com.backend.repositories.TaskRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class TaskDAO {
    private final TaskRepository taskRepository;

    public TaskDAO(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    public Task save(Task task) {
        return taskRepository.save(task);
    }

    public Optional<Task> getTaskById(Integer id) {
        return taskRepository.findById(id);
    }

    public Optional<Task> getTaskByTaskKey(String taskKey) {
        return taskRepository.findByTaskKey(taskKey);
    }

    public Optional<Task> getTaskByTaskKeyWithDetails(String taskKey) {
        return taskRepository.findByTaskKeyWithDetails(taskKey);
    }

    public List<Task> getTasksByProjectId(Integer projectId) {
        return taskRepository.findByProjectId(projectId);
    }

    public List<Task> getTasksByProjectIdWithDetails(Integer projectId) {
        return taskRepository.findByProjectIdWithDetails(projectId);
    }

    public void deleteTask(Task task) {
        taskRepository.delete(task);
    }

    public List<Task> getTasksAssignedToUser(Integer userId) {
        return taskRepository.findByAssigneeId(userId);
    }

    public List<Task> searchTasks(String query, Integer userId) {
        return taskRepository.searchTasksForUser(query, userId);
    }

    public List<Task> findByProjectKeyAndTaskNumbers(String projectKey, List<Integer> taskNumbers) {
        return taskRepository.findByProjectKeyAndTaskNumbers(projectKey, taskNumbers);
    }

    public List<Task> getTasksByStatus(TaskStatus status) {
        return taskRepository.findByStatus(status);
    }

    /**
     * Batch fetch tasks by IDs with all details - for dependency resolution.
     */
    public List<Task> getTasksByIdsWithDetails(List<Integer> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return taskRepository.findByIdsWithDetails(ids);
    }

    /**
     * Batch fetch tasks by task keys.
     */
    public List<Task> getTasksByTaskKeys(List<String> taskKeys) {
        if (taskKeys.isEmpty()) {
            return List.of();
        }
        return taskRepository.findByTaskKeys(taskKeys);
    }
}