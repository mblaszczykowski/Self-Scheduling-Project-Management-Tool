package com.backend.repositories;

import com.backend.entities.Task;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Integer> {
    List<Task> findByProjectId(Integer projectId);

    List<Task> findByAssigneeId(Integer assigneeId);

    List<Task> findBySummaryContainingIgnoreCaseAndProjectUsersId(String summary, Integer userId);
}
