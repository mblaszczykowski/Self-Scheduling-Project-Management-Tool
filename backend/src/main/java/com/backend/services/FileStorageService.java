package com.backend.services;

import com.backend.exception.FileStorageException;
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
    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "gif", "webp",
            "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
            "txt", "csv", "json", "xml"
    );

    private static final Map<String, byte[]> MAGIC_BYTES = Map.of(
            "jpg", new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF},
            "jpeg", new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF},
            "png", new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47},
            "gif", new byte[]{0x47, 0x49, 0x46},
            "pdf", new byte[]{0x25, 0x50, 0x44, 0x46}
    );

    public FileStorageService(@Value("${file.upload-dir}") String uploadDir) {
        this.fileStorageLocation = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.fileStorageLocation);
        } catch (Exception ex) {
            throw new FileStorageException("Could not create upload directory");
        }
    }

    public List<String> storeFiles(List<MultipartFile> files) {
        return files.stream()
                .map(this::storeFile)
                .collect(Collectors.toList());
    }

    public String storeFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new FileStorageException("Cannot store empty file");
        }

        String originalFileName = file.getOriginalFilename();
        if (originalFileName == null || originalFileName.isBlank()) {
            throw new FileStorageException("Invalid filename");
        }

        // Extract and validate extension
        String extension = getExtension(originalFileName).toLowerCase();
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new FileStorageException("File type not allowed: " + extension);
        }

        // Validate file size
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new FileStorageException("File size exceeds maximum allowed size of 5 MB");
        }

        // Validate magic bytes for known types
        if (MAGIC_BYTES.containsKey(extension)) {
            validateMagicBytes(file, extension);
        }

        try {
            // Generate safe filename - completely remove original name
            String safeFileName = UUID.randomUUID() + "." + extension;

            Path targetLocation = this.fileStorageLocation.resolve(safeFileName).normalize();

            // Security check: ensure resolved path is within storage directory
            if (!targetLocation.startsWith(this.fileStorageLocation)) {
                throw new FileStorageException("Invalid file path detected");
            }

            Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);

            return "/files/" + safeFileName;
        } catch (IOException ex) {
            throw new FileStorageException("Could not store file. Please try again");
        }
    }

    public void deleteFile(String filePath) {
        try {
            // Extract filename from path like "/files/uuid.ext"
            String fileName = filePath;
            if (fileName.startsWith("/files/")) {
                fileName = fileName.substring(7);
            }

            // Security: reject any path traversal attempts
            if (fileName.contains("/") || fileName.contains("\\") || fileName.contains("..")) {
                throw new FileStorageException("Invalid filename");
            }

            Path resolvedPath = this.fileStorageLocation.resolve(fileName).normalize();

            // Security check: ensure path is within storage directory
            if (!resolvedPath.startsWith(this.fileStorageLocation)) {
                throw new FileStorageException("Invalid file path");
            }

            if (Files.exists(resolvedPath)) {
                Files.delete(resolvedPath);
            }
        } catch (IOException ex) {
            throw new FileStorageException("Could not delete file");
        }
    }

    public Path getFilePath(String fileName) {
        // Security: reject path traversal
        if (fileName.contains("/") || fileName.contains("\\") || fileName.contains("..")) {
            throw new FileStorageException("Invalid filename");
        }

        Path resolvedPath = this.fileStorageLocation.resolve(fileName).normalize();

        if (!resolvedPath.startsWith(this.fileStorageLocation)) {
            throw new FileStorageException("Invalid file path");
        }

        return resolvedPath;
    }

    private String getExtension(String filename) {
        int lastDot = filename.lastIndexOf('.');
        if (lastDot == -1 || lastDot == filename.length() - 1) {
            throw new FileStorageException("File must have an extension");
        }
        return filename.substring(lastDot + 1);
    }

    private void validateMagicBytes(MultipartFile file, String extension) {
        try {
            byte[] fileBytes = file.getBytes();
            byte[] expected = MAGIC_BYTES.get(extension);

            if (fileBytes.length < expected.length) {
                throw new FileStorageException("File content doesn't match declared type");
            }

            for (int i = 0; i < expected.length; i++) {
                if (fileBytes[i] != expected[i]) {
                    throw new FileStorageException("File content doesn't match declared type");
                }
            }
        } catch (IOException e) {
            throw new FileStorageException("Could not validate file content");
        }
    }
}