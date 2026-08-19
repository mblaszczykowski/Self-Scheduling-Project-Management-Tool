package com.backend.controllers;

import com.backend.dtos.TaskDTO;
import com.backend.requests.TaskRequest;
import com.backend.requests.TaskScheduleRequest;
import com.backend.services.TaskService;
import com.backend.web.CurrentUserId;
import com.backend.web.RequestValidator;
import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/projects/{projectKey}/tasks")
public class TaskController {
    private final TaskService taskService;
    private final RequestValidator requestValidator;

    public TaskController(TaskService taskService, RequestValidator requestValidator) {
        this.taskService = taskService;
        this.requestValidator = requestValidator;
    }

    @PostMapping(consumes = {"multipart/form-data"})
    public ResponseEntity<TaskDTO> createTask(
            @CurrentUserId Integer userId,
            @PathVariable String projectKey,
            @RequestPart("taskDTO") String taskJson,
            @RequestPart(value = "attachments", required = false) List<MultipartFile> attachments
    ) throws JsonProcessingException {
        var request = requestValidator.parseAndValidate(taskJson, TaskRequest.class);
        var created = taskService.createTask(projectKey, request, userId, attachments);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping(value = "/{taskKey}", consumes = {"multipart/form-data"})
    public ResponseEntity<TaskDTO> updateTask(
            @CurrentUserId Integer userId,
            @PathVariable String projectKey,
            @PathVariable String taskKey,
            @RequestPart("taskDTO") String taskJson,
            @RequestPart(value = "attachments", required = false) List<MultipartFile> attachments
    ) throws JsonProcessingException {
        var request = requestValidator.parseAndValidate(taskJson, TaskRequest.class);
        return ResponseEntity.ok(taskService.updateTask(projectKey, taskKey, request, userId, attachments));
    }

    @PatchMapping("/{taskKey}/schedule")
    public ResponseEntity<TaskDTO> updateSchedule(
            @CurrentUserId Integer userId,
            @PathVariable String projectKey,
            @PathVariable String taskKey,
            @Valid @RequestBody TaskScheduleRequest request
    ) {
        return ResponseEntity.ok(taskService.updateSchedule(projectKey, taskKey, request, userId));
    }

    @DeleteMapping("/{taskKey}")
    public ResponseEntity<Void> deleteTask(@CurrentUserId Integer userId,
                                           @PathVariable String projectKey,
                                           @PathVariable String taskKey) {
        taskService.deleteTask(projectKey, taskKey, userId);
        return ResponseEntity.noContent().build();
    }
}
