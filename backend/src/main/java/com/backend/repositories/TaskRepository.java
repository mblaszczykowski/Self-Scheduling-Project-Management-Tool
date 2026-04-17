package com.backend.repositories;

import com.backend.entities.Task;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<Task, Integer> {

    @EntityGraph(value = "Task.withDetails", type = EntityGraph.EntityGraphType.FETCH)
    @Query("SELECT t FROM Task t WHERE t.project.id = :projectId ORDER BY t.taskNumber")
    List<Task> findByProjectIdWithDetails(@Param("projectId") Integer projectId);

    @EntityGraph("Task.withDetails")
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
        var lastDash = taskKey.lastIndexOf('-');
        var projectKey = taskKey.substring(0, lastDash);
        try {
            var taskNumber = Integer.parseInt(taskKey.substring(lastDash + 1));
            return findByProjectKeyAndTaskNumber(projectKey, taskNumber);
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    @EntityGraph(attributePaths = "project")
    @Query("SELECT t FROM Task t WHERE t.project.projectKey = :projectKey AND t.taskNumber IN :taskNumbers")
    List<Task> findByProjectKeyAndTaskNumbers(
            @Param("projectKey") String projectKey,
            @Param("taskNumbers") List<Integer> taskNumbers
    );

    @EntityGraph(value = "Task.withDetails", type = EntityGraph.EntityGraphType.FETCH)
    @Query("SELECT t FROM Task t WHERE t.project.id IN :projectIds ORDER BY t.taskNumber")
    List<Task> findByProjectIdsWithDetails(@Param("projectIds") List<Integer> projectIds);

    @EntityGraph(value = "Task.withDetails")
    @Query("SELECT t FROM Task t WHERE " +
           "(t.project.owner.id = :userId OR t.project.id IN (SELECT p.id FROM Project p JOIN p.members m WHERE m.id = :userId)) " +
           "AND (LOWER(t.summary) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(CONCAT(t.project.projectKey, '-', CAST(t.taskNumber AS string))) LIKE LOWER(CONCAT('%', :query, '%')))")
    List<Task> searchAccessible(@Param("userId") Integer userId, @Param("query") String query, Pageable pageable);

}