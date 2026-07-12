package com.backend.controllers;

import com.backend.dtos.TaskDTO;
import com.backend.requests.TaskRequest;
import com.backend.services.TaskService;
import com.backend.services.TokenService;
import com.backend.util.RequestValidator;
import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/projects/{projectKey}/tasks")
public class TaskController {

    private final TaskService taskService;
    private final TokenService tokenService;
    private final RequestValidator requestValidator;

    public TaskController(TaskService taskService, TokenService tokenService, RequestValidator requestValidator) {
        this.taskService = taskService;
        this.tokenService = tokenService;
        this.requestValidator = requestValidator;
    }

    @PostMapping(consumes = {"multipart/form-data"})
    public ResponseEntity<TaskDTO> createTask(
            HttpServletRequest request,
            @PathVariable String projectKey,
            @RequestPart("taskDTO") String taskDTOStr,
            @RequestPart(value = "attachments", required = false) List<MultipartFile> attachments
    ) throws JsonProcessingException {
        var userId = tokenService.getUserIdFromRequest(request);
        var taskRequest = requestValidator.parseAndValidate(taskDTOStr, TaskRequest.class);
        var createdTask = taskService.createTask(projectKey, taskRequest, userId, attachments);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdTask);
    }

    @PutMapping(value = "/{taskKey}", consumes = {"multipart/form-data"})
    public ResponseEntity<TaskDTO> updateTask(
            HttpServletRequest request,
            @PathVariable String projectKey,
            @PathVariable String taskKey,
            @RequestPart("taskDTO") String taskDTOStr,
            @RequestPart(value = "attachments", required = false) List<MultipartFile> attachments
    ) throws JsonProcessingException {
        var userId = tokenService.getUserIdFromRequest(request);
        var taskRequest = requestValidator.parseAndValidate(taskDTOStr, TaskRequest.class);
        var updatedTask = taskService.updateTask(projectKey, taskKey, taskRequest, userId, attachments);
        return ResponseEntity.ok(updatedTask);
    }

    @DeleteMapping("/{taskKey}")
    public ResponseEntity<Void> deleteTask(
            HttpServletRequest request,
            @PathVariable String projectKey,
            @PathVariable String taskKey
    ) {
        var userId = tokenService.getUserIdFromRequest(request);
        taskService.deleteTask(projectKey, taskKey, userId);
        return ResponseEntity.noContent().build();
    }
}
