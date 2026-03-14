package com.backend.controllers;

import com.backend.dtos.TaskDTO;
import com.backend.services.TaskService;
import com.backend.services.TokenService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    private final ObjectMapper objectMapper;

    public TaskController(TaskService taskService, TokenService tokenService, ObjectMapper objectMapper) {
        this.taskService = taskService;
        this.tokenService = tokenService;
        this.objectMapper = objectMapper;
    }

    @PostMapping(consumes = {"multipart/form-data"})
    public ResponseEntity<TaskDTO> createTask(
            HttpServletRequest request,
            @PathVariable String projectKey,
            @RequestPart("taskDTO") String taskDTOStr,
            @RequestPart(value = "attachments", required = false) List<MultipartFile> attachments
    ) throws JsonProcessingException {
        var userId = tokenService.getUserIdFromRequest(request);
        var taskDTO = objectMapper.readValue(taskDTOStr, TaskDTO.class);
        var createdTask = taskService.createTask(projectKey, taskDTO, userId, attachments);
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
        var taskDTO = objectMapper.readValue(taskDTOStr, TaskDTO.class);
        var updatedTask = taskService.updateTask(projectKey, taskKey, taskDTO, userId, attachments);
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