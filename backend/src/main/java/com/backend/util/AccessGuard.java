package com.backend.util;

import com.backend.entities.Comment;
import com.backend.entities.Project;
import com.backend.entities.Task;
import com.backend.exception.AuthorizationException;
import com.backend.exception.ResourceNotFoundException;
import com.backend.repositories.ProjectRepository;
import com.backend.repositories.TaskRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class AccessGuard {

    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;

    public AccessGuard(ProjectRepository projectRepository, TaskRepository taskRepository) {
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
    }

    public Project getAccessibleProject(String projectKey, Integer userId) {
        var project = projectRepository.findByProjectKeyWithOwnerAndMembers(projectKey)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        requireAccess(project, userId);
        return project;
    }

    public Project getAccessibleProjectWithLock(String projectKey, Integer userId) {
        var project = projectRepository.findByProjectKeyWithLock(projectKey)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        requireAccess(project, userId);
        return project;
    }

    public void requireAccess(Project project, Integer userId) {
        if (!project.hasAccess(userId)) {
            throw new ResourceNotFoundException("Project not found");
        }
    }

    public void requireOwner(Project project, Integer userId) {
        if (!project.isOwner(userId)) {
            throw new AuthorizationException("Only project owner can perform this action");
        }
    }

    public Task getAccessibleTask(String taskKey, Integer userId) {
        var task = taskRepository.findByTaskKey(taskKey)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found: " + taskKey));
        requireAccess(task.getProject(), userId);
        return task;
    }

    // Transactional so the lazy Project (and its owner/members) can be resolved for the
    // access check even when called directly from a controller (open-in-view is disabled).
    @Transactional(readOnly = true)
    public Task getAccessibleTaskById(Integer taskId, Integer userId) {
        var task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));
        requireAccess(task.getProject(), userId);
        return task;
    }

    public void requireCommentOwnership(Comment comment, Integer userId) {
        if (!comment.getAuthor().getId().equals(userId)) {
            throw new AuthorizationException("User not authorized to modify this comment");
        }
    }
}
