package com.backend.services;

import com.backend.config.AppProperties;
import com.backend.entities.StoredFile;
import com.backend.exception.FileStorageException;
import com.backend.exception.ValidationException;
import com.backend.repositories.StoredFileRepository;
import com.backend.util.FileValidationConstants;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.web.servlet.MultipartProperties;
import org.springframework.stereotype.Service;
import org.springframework.util.unit.DataSize;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.backend.util.AfterCommit;

@Service
public class FileStorageService {
    private static final Logger log = LoggerFactory.getLogger(FileStorageService.class);
    private static final String URL_PREFIX = "/files/";

    private final Path fileStorageLocation;
    private final StoredFileRepository storedFileRepository;
    private final DataSize maxFileSize;

    public FileStorageService(AppProperties appProperties, StoredFileRepository storedFileRepository,
                              MultipartProperties multipartProperties) {
        this.storedFileRepository = storedFileRepository;
        this.maxFileSize = multipartProperties.getMaxFileSize();
        this.fileStorageLocation = Paths.get(appProperties.getStorage().getUploadDir())
                .toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.fileStorageLocation);
        } catch (IOException ex) {
            throw new FileStorageException("Could not create upload directory");
        }
    }

    public List<String> storeFiles(List<MultipartFile> files, Integer projectId, Integer uploaderId) {
        if (files == null || files.isEmpty()) {
            return List.of();
        }
        if (files.size() > FileValidationConstants.MAX_ATTACHMENTS_PER_REQUEST) {
            throw new ValidationException("Too many files. Maximum "
                    + FileValidationConstants.MAX_ATTACHMENTS_PER_REQUEST + " files per request");
        }
        var extensions = files.stream().map(this::validateAndExtractExtension).toList();
        var stored = new ArrayList<String>(files.size());
        for (int i = 0; i < files.size(); i++) {
            stored.add(writeFile(files.get(i), extensions.get(i), projectId, uploaderId));
        }
        return stored;
    }

    public String storeFile(MultipartFile file, Integer projectId, Integer uploaderId) {
        return writeFile(file, validateAndExtractExtension(file), projectId, uploaderId);
    }

    private String writeFile(MultipartFile file, String extension, Integer projectId, Integer uploaderId) {
        var safeFileName = UUID.randomUUID() + "." + extension;
        var targetLocation = resolveAndValidatePath(safeFileName);

        try (var input = file.getInputStream()) {
            Files.copy(input, targetLocation, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ex) {
            throw new FileStorageException("Could not store file. Please try again");
        }

        storedFileRepository.save(new StoredFile(safeFileName, projectId, uploaderId));
        return URL_PREFIX + safeFileName;
    }

    public Optional<StoredFile> findOwnership(String storedName) {
        return storedFileRepository.findByStoredName(storedName);
    }

    public void requireAttachmentsBelongTo(Integer projectId, Collection<String> attachmentUrls) {
        if (attachmentUrls == null || attachmentUrls.isEmpty()) {
            return;
        }
        var names = attachmentUrls.stream()
                .map(FileStorageService::extractFileName)
                .collect(Collectors.toSet());

        var known = storedFileRepository.findByStoredNameIn(names);
        var byName = known.stream()
                .collect(Collectors.toMap(StoredFile::getStoredName, f -> f, (a, b) -> a));

        for (var name : names) {
            var ownership = byName.get(name);
            if (ownership == null) {
                throw new ValidationException("Attachment does not belong to this project");
            }
            if (ownership.getProjectId() == null || !ownership.getProjectId().equals(projectId)) {
                throw new ValidationException("Attachment does not belong to this project");
            }
        }
    }

    public List<String> resolveAttachments(Integer projectId, List<String> declared,
                                           List<MultipartFile> newFiles, Integer uploaderId) {
        requireAttachmentsBelongTo(projectId, declared);
        var merged = new ArrayList<>(declared);
        merged.addAll(storeFiles(newFiles, projectId, uploaderId));
        return merged;
    }

    public void deleteFile(String filePath) {
        var fileName = extractFileName(filePath);
        rejectPathTraversalAttempts(fileName);
        var resolvedPath = resolveAndValidatePath(fileName);
        try {
            Files.deleteIfExists(resolvedPath);
        } catch (IOException ex) {
            throw new FileStorageException("Could not delete file");
        }
        storedFileRepository.deleteByStoredNameIn(Set.of(fileName));
    }

    public void deleteFilesSilently(Collection<String> filePaths) {
        if (filePaths == null) {
            return;
        }
        for (var path : filePaths) {
            try {
                deleteFile(path);
            } catch (Exception e) {
                log.warn("Failed to delete file {}: {}", path, e.getMessage());
            }
        }
    }

    public void deleteRemovedAfterCommit(List<String> before, List<String> after, String description) {
        var removed = new ArrayList<>(before);
        removed.removeAll(new HashSet<>(after));
        if (removed.isEmpty()) {
            return;
        }
        AfterCommit.run(description, () -> deleteFilesSilently(removed));
    }

    public int deleteUnreferencedFiles(Duration minimumAge) {
        if (!Files.isDirectory(fileStorageLocation)) {
            return 0;
        }
        var referenced = storedFileRepository.findAllStoredNames();
        var cutoff = Instant.now().minus(minimumAge);
        int deleted = 0;
        try (var entries = Files.list(fileStorageLocation)) {
            for (var path : entries.toList()) {
                if (deleteIfUnreferencedAndStale(path, referenced, cutoff)) {
                    deleted++;
                }
            }
        } catch (IOException e) {
            log.warn("Could not list uploads to sweep: {}", e.getMessage());
        }
        return deleted;
    }

    private boolean deleteIfUnreferencedAndStale(Path path, Set<String> referenced, Instant cutoff) {
        try {
            var name = path.getFileName().toString();
            if (!Files.isRegularFile(path) || referenced.contains(name)) {
                return false;
            }
            if (Files.getLastModifiedTime(path).toInstant().isAfter(cutoff)) {
                return false;
            }
            return Files.deleteIfExists(path);
        } catch (IOException e) {
            log.warn("Could not sweep upload {}: {}", path.getFileName(), e.getMessage());
            return false;
        }
    }

    public Path getFilePath(String fileName) {
        rejectPathTraversalAttempts(fileName);
        return resolveAndValidatePath(fileName);
    }

    public static String extractFileName(String filePath) {
        if (filePath == null) {
            return "";
        }
        return filePath.startsWith(URL_PREFIX) ? filePath.substring(URL_PREFIX.length()) : filePath;
    }

    private String validateAndExtractExtension(MultipartFile file) {
        if (file.isEmpty()) {
            throw new ValidationException("Cannot store empty file");
        }
        var originalFileName = file.getOriginalFilename();
        if (originalFileName == null || originalFileName.isBlank()) {
            throw new ValidationException("Invalid filename");
        }
        var extension = extractExtension(originalFileName).toLowerCase();
        if (!FileValidationConstants.ALLOWED_EXTENSIONS.contains(extension)) {
            throw new ValidationException("File type not allowed: " + extension);
        }
        if (file.getSize() > maxFileSize.toBytes()) {
            throw new ValidationException(
                    "File size exceeds maximum allowed size of " + maxFileSize.toMegabytes() + " MB");
        }
        var expectedMagic = FileValidationConstants.MAGIC_BYTES_BY_EXTENSION.get(extension);
        if (expectedMagic != null) {
            validateMagicBytes(file, expectedMagic);
        }
        return extension;
    }

    private void rejectPathTraversalAttempts(String fileName) {
        if (fileName.isEmpty() || fileName.contains("/") || fileName.contains("\\")
                || fileName.contains("..")) {
            throw new ValidationException("Invalid filename");
        }
    }

    private Path resolveAndValidatePath(String fileName) {
        var resolvedPath = this.fileStorageLocation.resolve(fileName).normalize();
        if (!resolvedPath.startsWith(this.fileStorageLocation)) {
            throw new ValidationException("Invalid file path");
        }
        return resolvedPath;
    }

    private static String extractExtension(String filename) {
        var lastDot = filename.lastIndexOf('.');
        if (lastDot == -1 || lastDot == filename.length() - 1) {
            throw new ValidationException("File must have an extension");
        }
        return filename.substring(lastDot + 1);
    }

    private void validateMagicBytes(MultipartFile file, byte[] expectedMagicBytes) {
        byte[] header;
        try {
            header = FileValidationConstants.readHeader(file);
        } catch (UncheckedIOException e) {
            throw new FileStorageException("Could not validate file content");
        }
        if (!FileValidationConstants.startsWithMagicBytes(header, expectedMagicBytes)) {
            throw new ValidationException("File content doesn't match declared type");
        }
    }
}
