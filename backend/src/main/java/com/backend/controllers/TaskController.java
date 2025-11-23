package com.backend.controllers;

import com.backend.dtos.TaskDTO;
import com.backend.services.TaskService;
import com.backend.services.TokenService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("api/projects/{projectKey}/tasks")
public class TaskController {

    private final TaskService taskService;
    private final TokenService tokenService;

    public TaskController(TaskService taskService, TokenService tokenService) {
        this.taskService = taskService;
        this.tokenService = tokenService;
    }

    @PostMapping(consumes = {"multipart/form-data"})
    public ResponseEntity<TaskDTO> createTask(
            HttpServletRequest request,
            @PathVariable String projectKey,
            @RequestPart("taskDTO") String taskDTOStr,
            @RequestPart(value = "attachments", required = false) List<MultipartFile> attachments) throws JsonProcessingException {
        int userId = tokenService.getUserIdFromRequest(request);
        ObjectMapper objectMapper = new ObjectMapper();
        TaskDTO taskDTO = objectMapper.readValue(taskDTOStr, TaskDTO.class);
        TaskDTO createdTask = taskService.createTask(projectKey, taskDTO, userId, attachments);
        return ResponseEntity.ok(createdTask);
    }

    @PutMapping(value = "/{taskId}", consumes = {"multipart/form-data"})
    public ResponseEntity<TaskDTO> updateTask(
            HttpServletRequest request,
            @PathVariable String projectKey,
            @PathVariable String taskId,
            @RequestPart("taskDTO") String taskDTOStr,
            @RequestPart(value = "attachments", required = false) List<MultipartFile> attachments) throws JsonProcessingException {
        int userId = tokenService.getUserIdFromRequest(request);
        ObjectMapper objectMapper = new ObjectMapper();
        TaskDTO taskDTO = objectMapper.readValue(taskDTOStr, TaskDTO.class);
        TaskDTO updatedTask = taskService.updateTask(projectKey, taskId, taskDTO, userId, attachments);
        return ResponseEntity.ok(updatedTask);
    }

    @DeleteMapping("/{taskId}")
    public ResponseEntity<Void> deleteTask(
            HttpServletRequest request,
            @PathVariable String projectKey,
            @PathVariable String taskId) {
        int userId = tokenService.getUserIdFromRequest(request);
        taskService.deleteTask(projectKey, taskId, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/assigned")
    public ResponseEntity<List<TaskDTO>> getAssignedTasks(HttpServletRequest request) {
        Integer userId = tokenService.getUserIdFromRequest(request);
        List<TaskDTO> tasks = taskService.getTasksAssignedToUser(userId);
        return ResponseEntity.ok(tasks);
    }
}
