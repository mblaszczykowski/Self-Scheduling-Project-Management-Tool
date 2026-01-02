package com.backend.repositories;

import com.backend.entities.Project;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Integer> {

    Optional<Project> findByProjectKey(String projectKey);

    boolean existsByProjectKey(String projectKey);

    // Find projects where user is owner
    List<Project> findByOwnerId(Integer ownerId);

    // Find projects where user is a member
    List<Project> findByMembersId(Integer memberId);

    // Find all projects user has access to (owner or member)
    @Query("SELECT DISTINCT p FROM Project p LEFT JOIN p.members m " +
            "WHERE p.owner.id = :userId OR m.id = :userId")
    List<Project> findAllAccessibleByUser(@Param("userId") Integer userId);

    // Lock project row for task number allocation (prevents race conditions)
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Project p WHERE p.projectKey = :projectKey")
    Optional<Project> findByProjectKeyWithLock(@Param("projectKey") String projectKey);

    List<Project> findBySummaryContainingIgnoreCaseAndMembersId(String summary, Integer userId);

    @Query("SELECT p FROM Project p WHERE LOWER(p.summary) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "AND (p.owner.id = :userId OR :userId IN (SELECT m.id FROM p.members m))")
    List<Project> searchProjectsForUser(@Param("query") String query, @Param("userId") Integer userId);
}