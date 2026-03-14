package com.backend.controllers;

import com.backend.exception.FileStorageException;
import com.backend.services.FileStorageService;
import com.backend.services.TokenService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;

@RestController
@RequestMapping("/files")
public class FileController {

    private final FileStorageService fileStorageService;
    private final TokenService tokenService;

    public FileController(FileStorageService fileStorageService, TokenService tokenService) {
        this.fileStorageService = fileStorageService;
        this.tokenService = tokenService;
    }

    @GetMapping("/{fileName:.+}")
    public ResponseEntity<Resource> serveFile(@PathVariable String fileName, HttpServletRequest request) {
        tokenService.getUserIdFromRequest(request);
        try {
            var filePath = fileStorageService.getFilePath(fileName);
            var resource = new UrlResource(filePath.toUri());

            if (!resource.exists() || !resource.isReadable()) {
                throw new FileStorageException("File not found: " + fileName);
            }

            var contentType = Files.probeContentType(filePath);
            if (contentType == null) {
                contentType = "application/octet-stream";
            }

            var sanitizedFilename = sanitizeFilename(resource.getFilename());

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + sanitizedFilename + "\"")
                    .header(HttpHeaders.CONTENT_TYPE, contentType)
                    .header("X-Content-Type-Options", "nosniff")
                    .header("Cache-Control", "private, max-age=3600")
                    .body(resource);

        } catch (MalformedURLException ex) {
            throw new FileStorageException("File not found: " + fileName);
        } catch (IOException ex) {
            throw new FileStorageException("Could not determine file type");
        }
    }

    private String sanitizeFilename(String filename) {
        if (filename == null) {
            return "download";
        }
        return filename.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}