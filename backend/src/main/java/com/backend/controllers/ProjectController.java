package com.backend.controllers;

import com.backend.dtos.ProjectDTO;
import com.backend.services.ProjectService;
import com.backend.services.TokenService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectService projectService;
    private final TokenService tokenService;
    private final ObjectMapper objectMapper;

    public ProjectController(ProjectService projectService, TokenService tokenService,
                             ObjectMapper objectMapper) {
        this.projectService = projectService;
        this.tokenService = tokenService;
        this.objectMapper = objectMapper;
    }

    @GetMapping
    public ResponseEntity<?> getAllProjects(
            HttpServletRequest request,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false, defaultValue = "20") Integer size
    ) {
        var userId = tokenService.getUserIdFromRequest(request);
        if (page != null) {
            var pageable = PageRequest.of(page, Math.min(size, 100));
            return ResponseEntity.ok(projectService.getAllProjectsPaginated(userId, pageable));
        }
        return ResponseEntity.ok(projectService.getAllProjects(userId));
    }

    @GetMapping("/{projectKey}")
    public ResponseEntity<ProjectDTO> getProject(
            HttpServletRequest request,
            @PathVariable String projectKey
    ) {
        var userId = tokenService.getUserIdFromRequest(request);
        var project = projectService.getProjectByKey(projectKey, userId);
        return ResponseEntity.ok(project);
    }

    @PostMapping(consumes = {"multipart/form-data"})
    public ResponseEntity<ProjectDTO> createProject(
            HttpServletRequest request,
            @RequestPart("projectDTO") String projectDTOStr,
            @RequestPart(value = "attachments", required = false) List<MultipartFile> attachments
    ) throws JsonProcessingException {
        var userId = tokenService.getUserIdFromRequest(request);
        var projectDTO = objectMapper.readValue(projectDTOStr, ProjectDTO.class);
        var createdProject = projectService.createProject(projectDTO, userId, attachments);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdProject);
    }

    @PutMapping(value = "/{projectKey}", consumes = {"multipart/form-data"})
    public ResponseEntity<ProjectDTO> updateProject(
            HttpServletRequest request,
            @PathVariable String projectKey,
            @RequestPart("projectDTO") String projectDTOStr,
            @RequestPart(value = "attachments", required = false) List<MultipartFile> attachments
    ) throws JsonProcessingException {
        var userId = tokenService.getUserIdFromRequest(request);
        var projectDTO = objectMapper.readValue(projectDTOStr, ProjectDTO.class);
        var updatedProject = projectService.updateProject(projectKey, projectDTO, userId, attachments);
        return ResponseEntity.ok(updatedProject);
    }

    @DeleteMapping("/{projectKey}")
    public ResponseEntity<Void> deleteProject(
            HttpServletRequest request,
            @PathVariable String projectKey
    ) {
        var userId = tokenService.getUserIdFromRequest(request);
        projectService.deleteProject(projectKey, userId);
        return ResponseEntity.noContent().build();
    }
}