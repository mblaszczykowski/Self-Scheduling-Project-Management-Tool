package com.backend.daos;

import com.backend.entities.Task;
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

    public void addTask(Task task) {
        taskRepository.save(task);
    }

    public Optional<Task> getTaskById(Integer id) {
        return taskRepository.findById(id);
    }

    public List<Task> getTasksByProjectId(Integer projectId) {
        return taskRepository.findByProjectId(projectId);
    }

    public void updateTask(Task task) {
        taskRepository.save(task);
    }

    public void deleteTask(Task task) {
        taskRepository.delete(task);
    }

    public List<Task> getTasksAssignedToUser(Integer userId) {
        return taskRepository.findByAssigneeId(userId);
    }

    public List<Task> searchTasks(String query, Integer userId) {
        return taskRepository.findBySummaryContainingIgnoreCaseAndProjectUsersId(query, userId);
    }

}
