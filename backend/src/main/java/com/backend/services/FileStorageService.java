package com.backend.services;

import com.backend.exception.FileStorageException;
import com.backend.util.FileValidationConstants;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class FileStorageService {

    private final Path fileStorageLocation;

    public FileStorageService(@Value("${file.upload-dir}") String uploadDir) {
        this.fileStorageLocation = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.fileStorageLocation);
        } catch (Exception ex) {
            throw new FileStorageException("Could not create upload directory");
        }
    }

    public List<String> storeFiles(List<MultipartFile> files) {
        if (files.size() > FileValidationConstants.MAX_ATTACHMENTS_PER_REQUEST) {
            throw new FileStorageException("Too many files. Maximum " +
                    FileValidationConstants.MAX_ATTACHMENTS_PER_REQUEST + " files per request");
        }
        return files.stream()
                .map(this::storeFile)
                .collect(Collectors.toList());
    }

    public String storeFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new FileStorageException("Cannot store empty file");
        }

        var originalFileName = file.getOriginalFilename();
        if (originalFileName == null || originalFileName.isBlank()) {
            throw new FileStorageException("Invalid filename");
        }

        var extension = getExtension(originalFileName).toLowerCase();
        if (!FileValidationConstants.ALLOWED_EXTENSIONS.contains(extension)) {
            throw new FileStorageException("File type not allowed: " + extension);
        }

        if (file.getSize() > FileValidationConstants.MAX_FILE_SIZE) {
            throw new FileStorageException("File size exceeds maximum allowed size of 5 MB");
        }

        if (FileValidationConstants.MAGIC_BYTES_BY_EXTENSION.containsKey(extension)) {
            validateMagicBytes(file, extension);
        }

        try {
            var safeFileName = generateSafeFileName(extension);
            var targetLocation = resolveAndValidatePath(safeFileName);
            Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);
            return "/files/" + safeFileName;
        } catch (IOException ex) {
            throw new FileStorageException("Could not store file. Please try again");
        }
    }

    public void deleteFile(String filePath) {
        try {
            var fileName = extractFileNameFromPath(filePath);
            rejectPathTraversalAttempts(fileName);
            var resolvedPath = resolveAndValidatePath(fileName);

            if (Files.exists(resolvedPath)) {
                Files.delete(resolvedPath);
            }
        } catch (IOException ex) {
            throw new FileStorageException("Could not delete file");
        }
    }

    public Path getFilePath(String fileName) {
        rejectPathTraversalAttempts(fileName);
        return resolveAndValidatePath(fileName);
    }

    private String generateSafeFileName(String extension) {
        return UUID.randomUUID() + "." + extension;
    }

    private String extractFileNameFromPath(String filePath) {
        if (filePath.startsWith("/files/")) {
            return filePath.substring(7);
        }
        return filePath;
    }

    private void rejectPathTraversalAttempts(String fileName) {
        if (fileName.contains("/") || fileName.contains("\\") || fileName.contains("..")) {
            throw new FileStorageException("Invalid filename");
        }
    }

    private Path resolveAndValidatePath(String fileName) {
        var resolvedPath = this.fileStorageLocation.resolve(fileName).normalize();
        if (!resolvedPath.startsWith(this.fileStorageLocation)) {
            throw new FileStorageException("Invalid file path");
        }
        return resolvedPath;
    }

    private String getExtension(String filename) {
        var lastDot = filename.lastIndexOf('.');
        if (lastDot == -1 || lastDot == filename.length() - 1) {
            throw new FileStorageException("File must have an extension");
        }
        return filename.substring(lastDot + 1);
    }

    private void validateMagicBytes(MultipartFile file, String extension) {
        try {
            var fileBytes = file.getBytes();
            var expectedMagicBytes = FileValidationConstants.MAGIC_BYTES_BY_EXTENSION.get(extension);

            if (!FileValidationConstants.startsWithMagicBytes(fileBytes, expectedMagicBytes)) {
                throw new FileStorageException("File content doesn't match declared type");
            }
        } catch (IOException e) {
            throw new FileStorageException("Could not validate file content");
        }
    }
}