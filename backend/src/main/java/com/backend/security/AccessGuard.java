package com.backend.security;

import com.backend.entities.Comment;
import com.backend.entities.Project;
import com.backend.entities.Task;
import com.backend.exception.AuthorizationException;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
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

    /** Access check by project id, for callers that only hold a foreign key (file downloads). */
    @Transactional(readOnly = true)
    public void requireProjectAccessById(Integer projectId, Integer userId) {
        var project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        requireAccess(project, userId);
    }

    public Project getAccessibleProject(String projectKey, Integer userId) {
        var project = projectRepository.findByProjectKeyWithOwnerAndMembers(projectKey)
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

    public Project getOwnedProject(String projectKey, Integer userId) {
        var project = projectRepository.findByProjectKeyWithOwnerAndMembers(projectKey)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        requireAccess(project, userId);
        requireOwner(project, userId);
        return project;
    }

    /** Assert a task belongs to the given project (guards against cross-project task keys). */
    public void verifyTaskInProject(Task task, Project project) {
        if (!task.getProject().getId().equals(project.getId())) {
            throw new ValidationException("Task does not belong to the specified project");
        }
    }

    // Transactional so the lazy Project (and its owner/members) can be resolved for the
    // access check even when called directly from a controller (open-in-view is disabled).
    @Transactional(readOnly = true)
    public Task getAccessibleTaskById(Integer taskId, Integer userId) {
        var task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));
        if (!task.getProject().hasAccess(userId)) {
            throw new ResourceNotFoundException("Task not found");
        }
        return task;
    }

    public void requireCommentOwnership(Comment comment, Integer userId) {
        if (!comment.getAuthor().getId().equals(userId)) {
            throw new AuthorizationException("User not authorized to modify this comment");
        }
    }
}
