package com.backend.daos;

import com.backend.entities.Comment;
import com.backend.entities.CommentReaction;
import com.backend.entities.Task;
import com.backend.repositories.CommentReactionRepository;
import com.backend.repositories.CommentRepository;
import com.backend.repositories.TaskRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class CommentDAO {

    private final CommentRepository commentRepository;
    private final CommentReactionRepository commentReactionRepository;
    private final TaskRepository taskRepository;

    public CommentDAO(CommentRepository commentRepository,
                      CommentReactionRepository commentReactionRepository,
                      TaskRepository taskRepository) {
        this.commentRepository = commentRepository;
        this.commentReactionRepository = commentReactionRepository;
        this.taskRepository = taskRepository;
    }

    public Comment addComment(Comment comment) {
        return commentRepository.save(comment);
    }

    public Optional<Comment> getCommentById(Integer id) {
        return commentRepository.findById(id);
    }

    public Optional<Comment> getCommentByIdWithTaskAndProject(Integer id) {
        return commentRepository.findByIdWithTaskAndProject(id);
    }

    public List<Comment> getTopLevelCommentsByTaskIdWithDetails(Integer taskId) {
        return commentRepository.findTopLevelCommentsByTaskIdWithDetails(taskId);
    }

    public List<Comment> getRepliesByParentIds(List<Integer> parentIds) {
        if (parentIds.isEmpty()) {
            return List.of();
        }
        return commentRepository.findRepliesByParentIdsWithDetails(parentIds);
    }

    public Comment updateComment(Comment comment) {
        return commentRepository.save(comment);
    }

    public void deleteComment(Comment comment) {
        commentRepository.delete(comment);
    }

    public Optional<Task> getTaskById(Integer taskId) {
        return taskRepository.findById(taskId);
    }

    public void addReaction(CommentReaction reaction) {
        commentReactionRepository.save(reaction);
    }

    public void removeReaction(CommentReaction reaction) {
        commentReactionRepository.delete(reaction);
    }

    public void updateReaction(CommentReaction reaction) {
        commentReactionRepository.save(reaction);
    }

    public Optional<CommentReaction> findReaction(Integer commentId, Integer userId) {
        return commentReactionRepository.findByCommentIdAndUserId(commentId, userId);
    }
}