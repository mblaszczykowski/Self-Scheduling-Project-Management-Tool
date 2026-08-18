package com.backend.controllers;

import com.backend.dtos.PagedResponse;
import com.backend.dtos.TaskActivityDTO;
import com.backend.security.AccessGuard;
import com.backend.services.TaskActivityService;
import com.backend.web.CurrentUserId;
import com.backend.web.PageRequests;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/tasks/{taskId}/activities")
public class TaskActivityController {

    private final TaskActivityService taskActivityService;
    private final AccessGuard accessGuard;
    private final PageRequests pageRequests;

    public TaskActivityController(TaskActivityService taskActivityService,
                                  AccessGuard accessGuard,
                                  PageRequests pageRequests) {
        this.taskActivityService = taskActivityService;
        this.accessGuard = accessGuard;
        this.pageRequests = pageRequests;
    }

    @GetMapping
    public ResponseEntity<PagedResponse<TaskActivityDTO>> getActivities(
            @CurrentUserId Integer userId,
            @PathVariable Integer taskId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size
    ) {
        accessGuard.getAccessibleTaskById(taskId, userId);
        var pageable = pageRequests.of(page, size);
        return ResponseEntity.ok(PagedResponse.of(
                taskActivityService.getActivitiesForTask(taskId, pageable)));
    }
}
