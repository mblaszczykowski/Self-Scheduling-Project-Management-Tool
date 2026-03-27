package com.backend.controllers;

import com.backend.dtos.TaskActivityDTO;
import com.backend.services.TaskActivityService;
import com.backend.services.TokenService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks/{taskId}/activities")
public class TaskActivityController {

    private final TaskActivityService taskActivityService;
    private final TokenService tokenService;

    public TaskActivityController(TaskActivityService taskActivityService, TokenService tokenService) {
        this.taskActivityService = taskActivityService;
        this.tokenService = tokenService;
    }

    @GetMapping
    public ResponseEntity<List<TaskActivityDTO>> getActivities(
            HttpServletRequest request,
            @PathVariable Integer taskId
    ) {
        tokenService.getUserIdFromRequest(request);
        var activities = taskActivityService.getActivitiesForTask(taskId);
        return ResponseEntity.ok(activities);
    }
}
