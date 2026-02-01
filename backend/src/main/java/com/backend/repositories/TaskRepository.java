package com.backend.repositories;

import com.backend.entities.Task;
import com.backend.entities.TaskStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<Task, Integer> {

    @EntityGraph(value = "Task.withDetails", type = EntityGraph.EntityGraphType.FETCH)
    @Query("SELECT t FROM Task t WHERE t.project.id = :projectId ORDER BY t.taskNumber")
    List<Task> findByProjectIdWithDetails(@Param("projectId") Integer projectId);

    List<Task> findByProjectId(Integer projectId);

    @EntityGraph(value = "Task.withDetails", type = EntityGraph.EntityGraphType.FETCH)
    List<Task> findByAssigneeId(Integer assigneeId);

    @Query("SELECT t FROM Task t WHERE t.project.projectKey = :projectKey AND t.taskNumber = :taskNumber")
    Optional<Task> findByProjectKeyAndTaskNumber(
            @Param("projectKey") String projectKey,
            @Param("taskNumber") Integer taskNumber
    );

    @EntityGraph(value = "Task.withDetails", type = EntityGraph.EntityGraphType.FETCH)
    @Query("SELECT t FROM Task t WHERE t.project.projectKey = :projectKey AND t.taskNumber = :taskNumber")
    Optional<Task> findByProjectKeyAndTaskNumberWithDetails(
            @Param("projectKey") String projectKey,
            @Param("taskNumber") Integer taskNumber
    );

    default Optional<Task> findByTaskKey(String taskKey) {
        if (taskKey == null || !taskKey.contains("-")) {
            return Optional.empty();
        }
        int lastDash = taskKey.lastIndexOf('-');
        String projectKey = taskKey.substring(0, lastDash);
        try {
            Integer taskNumber = Integer.parseInt(taskKey.substring(lastDash + 1));
            return findByProjectKeyAndTaskNumber(projectKey, taskNumber);
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    default Optional<Task> findByTaskKeyWithDetails(String taskKey) {
        if (taskKey == null || !taskKey.contains("-")) {
            return Optional.empty();
        }
        int lastDash = taskKey.lastIndexOf('-');
        String projectKey = taskKey.substring(0, lastDash);
        try {
            Integer taskNumber = Integer.parseInt(taskKey.substring(lastDash + 1));
            return findByProjectKeyAndTaskNumberWithDetails(projectKey, taskNumber);
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    @Query("SELECT t FROM Task t WHERE LOWER(t.summary) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "AND (t.project.owner.id = :userId OR :userId IN (SELECT m.id FROM t.project.members m))")
    List<Task> searchTasksForUser(@Param("query") String query, @Param("userId") Integer userId);

    // Paginated version for large result sets
    @Query("SELECT t FROM Task t WHERE LOWER(t.summary) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "AND (t.project.owner.id = :userId OR :userId IN (SELECT m.id FROM t.project.members m))")
    Page<Task> searchTasksForUser(@Param("query") String query, @Param("userId") Integer userId, Pageable pageable);

    @Query("SELECT t FROM Task t WHERE t.project.projectKey = :projectKey AND t.taskNumber IN :taskNumbers")
    List<Task> findByProjectKeyAndTaskNumbers(
            @Param("projectKey") String projectKey,
            @Param("taskNumbers") List<Integer> taskNumbers
    );

    List<Task> findByStatus(TaskStatus status);

    @Query("SELECT t FROM Task t WHERE t.project.id = :projectId AND t.status = :status")
    List<Task> findByProjectIdAndStatus(@Param("projectId") Integer projectId, @Param("status") TaskStatus status);

    // Batch fetch tasks by IDs with details - for dependency resolution
    @EntityGraph(value = "Task.withDetails", type = EntityGraph.EntityGraphType.FETCH)
    @Query("SELECT t FROM Task t WHERE t.id IN :ids")
    List<Task> findByIdsWithDetails(@Param("ids") List<Integer> ids);

    // Batch fetch tasks by task keys
    @Query("SELECT t FROM Task t WHERE CONCAT(t.project.projectKey, '-', t.taskNumber) IN :taskKeys")
    List<Task> findByTaskKeys(@Param("taskKeys") List<String> taskKeys);
}