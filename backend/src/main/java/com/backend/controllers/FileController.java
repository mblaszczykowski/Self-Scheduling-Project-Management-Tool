package com.backend.controllers;

import com.backend.exception.ResourceNotFoundException;
import com.backend.security.AccessGuard;
import com.backend.services.FileStorageService;
import com.backend.web.CurrentUserId;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.file.Files;

@RestController
@RequestMapping("/files")
public class FileController {
    private final FileStorageService fileStorageService;
    private final AccessGuard accessGuard;

    public FileController(FileStorageService fileStorageService, AccessGuard accessGuard) {
        this.fileStorageService = fileStorageService;
        this.accessGuard = accessGuard;
    }

    @GetMapping("/{fileName:.+}")
    public ResponseEntity<Resource> serveFile(@CurrentUserId Integer userId,
                                              @PathVariable String fileName) {
        requireAccess(fileName, userId);

        var filePath = fileStorageService.getFilePath(fileName);
        try {
            var resource = new UrlResource(filePath.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new ResourceNotFoundException("File not found");
            }

            var contentType = Files.probeContentType(filePath);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + sanitizeFilename(resource.getFilename()) + "\"")
                    .header(HttpHeaders.CONTENT_TYPE,
                            contentType != null ? contentType : "application/octet-stream")
                    .header("X-Content-Type-Options", "nosniff")
                    .header("Cache-Control", "private, max-age=3600")
                    .body(resource);
        } catch (IOException ex) {
            throw new ResourceNotFoundException("File not found");
        }
    }

    private void requireAccess(String fileName, Integer userId) {
        var ownership = fileStorageService.findOwnership(FileStorageService.extractFileName(fileName))
                .orElseThrow(() -> new ResourceNotFoundException("File not found"));
        var projectId = ownership.getProjectId();
        if (projectId == null) {
            return;
        }
        accessGuard.requireProjectAccessById(projectId, userId);
    }

    private static String sanitizeFilename(String filename) {
        if (filename == null) {
            return "download";
        }
        return filename.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
