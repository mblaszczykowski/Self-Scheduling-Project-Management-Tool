package com.backend.repositories;

import com.backend.entities.Project;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Integer> {

    Optional<Project> findByProjectKey(String projectKey);

    // Fetch project with owner and members eagerly to avoid N+1
    @EntityGraph(value = "Project.withMembers", type = EntityGraph.EntityGraphType.FETCH)
    @Query("SELECT p FROM Project p WHERE p.projectKey = :projectKey")
    Optional<Project> findByProjectKeyWithDetails(@Param("projectKey") String projectKey);

    boolean existsByProjectKey(String projectKey);

    // Find projects where user is owner
    List<Project> findByOwnerId(Integer ownerId);

    // Find projects where user is a member
    List<Project> findByMembersId(Integer memberId);

    // Find all projects user has access to (owner or member) - optimized with JOIN FETCH
    @Query("SELECT DISTINCT p FROM Project p " +
            "LEFT JOIN FETCH p.owner " +
            "LEFT JOIN FETCH p.members m " +
            "WHERE p.owner.id = :userId OR m.id = :userId")
    List<Project> findAllAccessibleByUser(@Param("userId") Integer userId);

    // Separate query to fetch tasks for projects (avoids cartesian product)
    @Query("SELECT DISTINCT p FROM Project p " +
            "LEFT JOIN FETCH p.tasks " +
            "WHERE p.id IN :projectIds")
    List<Project> findByIdsWithTasks(@Param("projectIds") List<Integer> projectIds);

    // Lock project row for task number allocation (prevents race conditions)
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Project p WHERE p.projectKey = :projectKey")
    Optional<Project> findByProjectKeyWithLock(@Param("projectKey") String projectKey);

    List<Project> findBySummaryContainingIgnoreCaseAndMembersId(String summary, Integer userId);

    @Query("SELECT p FROM Project p WHERE LOWER(p.summary) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "AND (p.owner.id = :userId OR :userId IN (SELECT m.id FROM p.members m))")
    List<Project> searchProjectsForUser(@Param("query") String query, @Param("userId") Integer userId);

    // Paginated version for large result sets
    @Query("SELECT p FROM Project p WHERE LOWER(p.summary) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "AND (p.owner.id = :userId OR :userId IN (SELECT m.id FROM p.members m))")
    Page<Project> searchProjectsForUser(@Param("query") String query, @Param("userId") Integer userId, Pageable pageable);

    // Check if two users share at least one project (both have access)
    @Query("SELECT COUNT(p) > 0 FROM Project p LEFT JOIN p.members m " +
            "WHERE (p.owner.id = :userId1 OR :userId1 IN (SELECT m1.id FROM p.members m1)) " +
            "AND (p.owner.id = :userId2 OR :userId2 IN (SELECT m2.id FROM p.members m2))")
    boolean doUsersShareProject(@Param("userId1") Integer userId1, @Param("userId2") Integer userId2);
}