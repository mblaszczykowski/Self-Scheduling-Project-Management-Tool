package com.backend.controllers;

import com.backend.dtos.PagedResponse;
import com.backend.dtos.ProjectDTO;
import com.backend.requests.ProjectRequest;
import com.backend.services.ProjectService;
import com.backend.web.CurrentUserId;
import com.backend.web.PageRequests;
import com.backend.web.RequestValidator;
import com.fasterxml.jackson.core.JsonProcessingException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectService projectService;
    private final RequestValidator requestValidator;
    private final PageRequests pageRequests;

    public ProjectController(ProjectService projectService,
                             RequestValidator requestValidator,
                             PageRequests pageRequests) {
        this.projectService = projectService;
        this.requestValidator = requestValidator;
        this.pageRequests = pageRequests;
    }

    /**
     * Always paginated. The endpoint previously had two modes — paginated when {@code page} was
     * present, the entire portfolio with every task otherwise — and no client ever sent
     * {@code page}, so the unbounded branch was the only one that ran and the paginated one had
     * never been executed at all.
     */
    @GetMapping
    public ResponseEntity<PagedResponse<ProjectDTO>> getProjects(
            @CurrentUserId Integer userId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size
    ) {
        var pageable = pageRequests.of(page, size);
        return ResponseEntity.ok(PagedResponse.of(projectService.getProjects(userId, pageable)));
    }

    @GetMapping("/{projectKey}")
    public ResponseEntity<ProjectDTO> getProject(@CurrentUserId Integer userId,
                                                 @PathVariable String projectKey) {
        return ResponseEntity.ok(projectService.getProjectByKey(projectKey, userId));
    }

    @PostMapping(consumes = {"multipart/form-data"})
    public ResponseEntity<ProjectDTO> createProject(
            @CurrentUserId Integer userId,
            @RequestPart("projectDTO") String projectJson,
            @RequestPart(value = "attachments", required = false) List<MultipartFile> attachments
    ) throws JsonProcessingException {
        var request = requestValidator.parseAndValidate(projectJson, ProjectRequest.class);
        var created = projectService.createProject(request, userId, attachments);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping(value = "/{projectKey}", consumes = {"multipart/form-data"})
    public ResponseEntity<ProjectDTO> updateProject(
            @CurrentUserId Integer userId,
            @PathVariable String projectKey,
            @RequestPart("projectDTO") String projectJson,
            @RequestPart(value = "attachments", required = false) List<MultipartFile> attachments
    ) throws JsonProcessingException {
        var request = requestValidator.parseAndValidate(projectJson, ProjectRequest.class);
        return ResponseEntity.ok(projectService.updateProject(projectKey, request, userId, attachments));
    }

    @DeleteMapping("/{projectKey}")
    public ResponseEntity<Void> deleteProject(@CurrentUserId Integer userId,
                                              @PathVariable String projectKey) {
        projectService.deleteProject(projectKey, userId);
        return ResponseEntity.noContent().build();
    }
}
