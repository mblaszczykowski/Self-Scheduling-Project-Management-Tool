package com.backend.repositories;

import com.backend.entities.Comment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CommentRepository extends JpaRepository<Comment, Integer> {

    @Query("SELECT DISTINCT c FROM Comment c " +
            "LEFT JOIN FETCH c.author " +
            "LEFT JOIN FETCH c.reactions r " +
            "LEFT JOIN FETCH r.user " +
            "LEFT JOIN FETCH c.attachments " +
            "WHERE c.task.id = :taskId AND c.parentComment IS NULL " +
            "ORDER BY c.timestamp")
    List<Comment> findTopLevelCommentsByTaskIdWithDetails(@Param("taskId") Integer taskId);

    @Query("SELECT DISTINCT c FROM Comment c " +
            "LEFT JOIN FETCH c.author " +
            "LEFT JOIN FETCH c.reactions r " +
            "LEFT JOIN FETCH r.user " +
            "LEFT JOIN FETCH c.attachments " +
            "WHERE c.parentComment.id IN :parentIds " +
            "ORDER BY c.timestamp")
    List<Comment> findRepliesByParentIdsWithDetails(@Param("parentIds") List<Integer> parentIds);

    @Query("SELECT c FROM Comment c " +
            "LEFT JOIN FETCH c.author " +
            "LEFT JOIN FETCH c.task t " +
            "LEFT JOIN FETCH t.project " +
            "WHERE c.id = :id")
    Optional<Comment> findByIdWithTaskAndProject(@Param("id") Integer id);
}