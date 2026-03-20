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

    @EntityGraph("Project.withMembers")
    Optional<Project> findByProjectKey(String projectKey);

    boolean existsByProjectKey(String projectKey);

    @Query("SELECT DISTINCT p FROM Project p " +
            "LEFT JOIN FETCH p.owner " +
            "LEFT JOIN FETCH p.members " +
            "WHERE p.owner.id = :userId OR p.id IN " +
            "(SELECT p2.id FROM Project p2 JOIN p2.members m2 WHERE m2.id = :userId)")
    List<Project> findAllAccessibleByUser(@Param("userId") Integer userId);

    @Query("SELECT DISTINCT p FROM Project p " +
            "LEFT JOIN FETCH p.owner " +
            "LEFT JOIN FETCH p.members " +
            "WHERE p.owner.id = :userId OR p.id IN " +
            "(SELECT p2.id FROM Project p2 JOIN p2.members m2 WHERE m2.id = :userId)")
    Page<Project> findAllAccessibleByUserPaged(@Param("userId") Integer userId, Pageable pageable);

    @Query("SELECT p FROM Project p LEFT JOIN FETCH p.owner LEFT JOIN FETCH p.members WHERE p.projectKey = :projectKey")
    Optional<Project> findByProjectKeyWithOwnerAndMembers(@Param("projectKey") String projectKey);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Project p LEFT JOIN FETCH p.owner LEFT JOIN FETCH p.members WHERE p.projectKey = :projectKey")
    Optional<Project> findByProjectKeyWithLock(@Param("projectKey") String projectKey);

    @Query("SELECT p FROM Project p LEFT JOIN FETCH p.owner LEFT JOIN FETCH p.members WHERE p.projectKey IN :keys")
    List<Project> findByProjectKeyIn(@Param("keys") List<String> keys);

    @Query("SELECT COUNT(p) > 0 FROM Project p LEFT JOIN p.members m " +
            "WHERE (p.owner.id = :userId1 OR :userId1 IN (SELECT m1.id FROM p.members m1)) " +
            "AND (p.owner.id = :userId2 OR :userId2 IN (SELECT m2.id FROM p.members m2))")
    boolean doUsersShareProject(@Param("userId1") Integer userId1, @Param("userId2") Integer userId2);
}