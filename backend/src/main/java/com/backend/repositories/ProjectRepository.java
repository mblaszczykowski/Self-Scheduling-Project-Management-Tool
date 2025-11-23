package com.backend.repositories;

import com.backend.entities.Project;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Integer> {
    Optional<Project> findByProjectKey(String projectKey);
    boolean existsByProjectKey(String projectKey);
    List<Project> findByUserId(Integer userId);
    List<Project> findByUsersId(Integer userId);
    List<Project> findBySummaryContainingIgnoreCaseAndUsersId(String summary, Integer userId);

}
