package com.backend.repositories;

import com.backend.entities.Comment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CommentRepository extends JpaRepository<Comment, Integer> {
    @Query(value = "SELECT c.id FROM Comment c "
            + "WHERE c.task.id = :taskId AND c.parentComment IS NULL "
            + "ORDER BY c.timestamp, c.id",
            countQuery = "SELECT COUNT(c) FROM Comment c WHERE c.task.id = :taskId AND c.parentComment IS NULL")
    Page<Integer> findTopLevelCommentIds(@Param("taskId") Integer taskId, Pageable pageable);

    @Query("SELECT DISTINCT c FROM Comment c "
            + "LEFT JOIN FETCH c.author "
            + "LEFT JOIN FETCH c.reactions r "
            + "LEFT JOIN FETCH r.user "
            + "WHERE c.id IN :ids "
            + "ORDER BY c.timestamp, c.id")
    List<Comment> findTopLevelCommentsWithDetails(@Param("ids") Collection<Integer> ids);

    @Query("SELECT DISTINCT c FROM Comment c " +
            "LEFT JOIN FETCH c.author " +
            "LEFT JOIN FETCH c.reactions r " +
            "LEFT JOIN FETCH r.user " +
            "WHERE c.parentComment.id IN :parentIds " +
            "ORDER BY c.timestamp, c.id")
    List<Comment> findRepliesByParentIdsWithDetails(@Param("parentIds") List<Integer> parentIds);

    @Query("SELECT c FROM Comment c " +
            "LEFT JOIN FETCH c.author " +
            "LEFT JOIN FETCH c.task t " +
            "LEFT JOIN FETCH t.project " +
            "WHERE c.id = :id")
    Optional<Comment> findByIdWithTaskAndProject(@Param("id") Integer id);

    @Query("SELECT c FROM Comment c JOIN FETCH c.author JOIN FETCH c.task t JOIN FETCH t.project WHERE " +
            "(t.project.owner.id = :userId OR t.project.id IN " +
            "(SELECT p.id FROM Project p JOIN p.members m WHERE m.id = :userId)) " +
            "AND LOWER(c.content) LIKE LOWER(:pattern) ESCAPE '!' " +
            "ORDER BY c.timestamp DESC, c.id DESC")
    List<Comment> searchAccessible(@Param("userId") Integer userId,
                                   @Param("pattern") String pattern,
                                   Pageable pageable);
}
