package com.backend.repositories;

import com.backend.entities.Comment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CommentRepository extends JpaRepository<Comment, Integer> {

    // Fetch only ONE collection (reactions + their users) here. The attachments collection is
    // loaded lazily and batched (default_batch_fetch_size); fetching both collections in one
    // query would produce a comments x reactions x attachments cartesian product.
    @Query(value = "SELECT DISTINCT c FROM Comment c " +
            "LEFT JOIN FETCH c.author " +
            "LEFT JOIN FETCH c.reactions r " +
            "LEFT JOIN FETCH r.user " +
            "WHERE c.task.id = :taskId AND c.parentComment IS NULL " +
            "ORDER BY c.timestamp, c.id",
            countQuery = "SELECT COUNT(c) FROM Comment c WHERE c.task.id = :taskId AND c.parentComment IS NULL")
    Page<Comment> findTopLevelCommentsByTaskId(@Param("taskId") Integer taskId, Pageable pageable);

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
