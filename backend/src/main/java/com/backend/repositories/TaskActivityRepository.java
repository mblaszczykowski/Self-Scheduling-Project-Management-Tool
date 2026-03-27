package com.backend.repositories;

import com.backend.entities.TaskActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface TaskActivityRepository extends JpaRepository<TaskActivity, Integer> {

    @Query("SELECT a FROM TaskActivity a JOIN FETCH a.author WHERE a.task.id = :taskId ORDER BY a.timestamp DESC")
    List<TaskActivity> findByTaskIdWithAuthor(Integer taskId);
}
