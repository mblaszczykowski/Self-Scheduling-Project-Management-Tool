package com.backend.controllers;

import com.backend.dtos.ProjectDTO;
import com.backend.services.ProjectService;
import com.backend.services.TokenService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("api/projects")
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
    public ResponseEntity<List<ProjectDTO>> getAllProjects(HttpServletRequest request) {
        int userId = tokenService.getUserIdFromRequest(request);
        List<ProjectDTO> projects = projectService.getAllProjects(userId);
        return ResponseEntity.ok(projects);
    }

    @GetMapping("/{projectKey}")
    public ResponseEntity<ProjectDTO> getProject(
            HttpServletRequest request,
            @PathVariable String projectKey
    ) {
        int userId = tokenService.getUserIdFromRequest(request);
        ProjectDTO project = projectService.getProjectByKey(projectKey, userId);
        return ResponseEntity.ok(project);
    }

    @PostMapping(consumes = {"multipart/form-data"})
    public ResponseEntity<ProjectDTO> createProject(
            HttpServletRequest request,
            @RequestPart("projectDTO") String projectDTOStr,
            @RequestPart(value = "attachments", required = false) List<MultipartFile> attachments
    ) throws JsonProcessingException {
        int userId = tokenService.getUserIdFromRequest(request);
        ProjectDTO projectDTO = objectMapper.readValue(projectDTOStr, ProjectDTO.class);
        ProjectDTO createdProject = projectService.createProject(projectDTO, userId, attachments);
        return ResponseEntity.ok(createdProject);
    }

    @PutMapping(value = "/{projectKey}", consumes = {"multipart/form-data"})
    public ResponseEntity<ProjectDTO> updateProject(
            HttpServletRequest request,
            @PathVariable String projectKey,
            @RequestPart("projectDTO") String projectDTOStr,
            @RequestPart(value = "attachments", required = false) List<MultipartFile> attachments
    ) throws JsonProcessingException {
        int userId = tokenService.getUserIdFromRequest(request);
        ProjectDTO projectDTO = objectMapper.readValue(projectDTOStr, ProjectDTO.class);
        ProjectDTO updatedProject = projectService.updateProject(projectDTO, userId, attachments);
        return ResponseEntity.ok(updatedProject);
    }

    @DeleteMapping("/{projectKey}")
    public ResponseEntity<Void> deleteProject(
            HttpServletRequest request,
            @PathVariable String projectKey
    ) {
        int userId = tokenService.getUserIdFromRequest(request);
        projectService.deleteProject(projectKey, userId);
        return ResponseEntity.noContent().build();
    }
}