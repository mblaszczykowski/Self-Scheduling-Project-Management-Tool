package com.backend.repositories;

import com.backend.entities.TaskActivity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TaskActivityRepository extends JpaRepository<TaskActivity, Integer> {

    @Query("SELECT a FROM TaskActivity a JOIN FETCH a.author WHERE a.task.id = :taskId " +
            "ORDER BY a.timestamp DESC, a.id DESC")
    Page<TaskActivity> findByTaskIdWithAuthor(@Param("taskId") Integer taskId, Pageable pageable);
}
