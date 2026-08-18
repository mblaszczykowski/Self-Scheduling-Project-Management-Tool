package com.backend.services;

import com.backend.config.AppProperties;
import com.backend.entities.StoredFile;
import com.backend.exception.FileStorageException;
import com.backend.exception.ValidationException;
import com.backend.repositories.StoredFileRepository;
import com.backend.util.FileValidationConstants;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.backend.util.AfterCommit;

/**
 * Stores uploads under a single directory with generated names, and records who each file
 * belongs to so downloads can be authorized.
 *
 * <p>The client's filename is discarded entirely rather than sanitised, which removes the whole
 * class of traversal and double-extension tricks. {@code svg} and {@code html} are absent from
 * the allowlist on purpose: they are the two types that would turn an upload into stored XSS.
 */
@Service
public class FileStorageService {

    private static final Logger log = LoggerFactory.getLogger(FileStorageService.class);
    private static final String URL_PREFIX = "/files/";

    private final Path fileStorageLocation;
    private final StoredFileRepository storedFileRepository;

    public FileStorageService(AppProperties appProperties, StoredFileRepository storedFileRepository) {
        this.storedFileRepository = storedFileRepository;
        this.fileStorageLocation = Paths.get(appProperties.getStorage().getUploadDir())
                .toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.fileStorageLocation);
        } catch (IOException ex) {
            throw new FileStorageException("Could not create upload directory");
        }
    }

    // ======================== Storing ========================

    /**
     * @param projectId the project the files belong to, or null for files that are not
     *                  project-scoped (profile pictures)
     */
    public List<String> storeFiles(List<MultipartFile> files, Integer projectId, Integer uploaderId) {
        if (files == null || files.isEmpty()) {
            return List.of();
        }
        if (files.size() > FileValidationConstants.MAX_ATTACHMENTS_PER_REQUEST) {
            throw new ValidationException("Too many files. Maximum "
                    + FileValidationConstants.MAX_ATTACHMENTS_PER_REQUEST + " files per request");
        }
        return files.stream()
                .map(file -> storeFile(file, projectId, uploaderId))
                .toList();
    }

    public String storeFile(MultipartFile file, Integer projectId, Integer uploaderId) {
        var extension = validateAndExtractExtension(file);
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

    // ======================== Authorization support ========================

    /** @return the ownership record for a stored name, if one was recorded. */
    public Optional<StoredFile> findOwnership(String storedName) {
        return storedFileRepository.findByStoredName(storedName);
    }

    /**
     * Rejects any attachment reference that does not belong to the given project.
     *
     * <p>Attachment lists arrive from the client on every update. Without this check a user could
     * graft another project's file onto their own task — and then delete the task, taking the
     * other project's file off disk with it.
     */
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
                // Uploaded before ownership was recorded (pre-V5). Accept, since rejecting would
                // make historic attachments un-editable, but do not let it move between projects.
                continue;
            }
            // A row with no project is deliberately unscoped — a profile picture. Those are
            // readable by every member through the member views, and their URLs travel in every
            // UserDTO, which is exactly why claiming one as a task attachment has to be refused:
            // whoever attaches a file also gets to detach it, and detaching unlinks it from disk.
            // Any account could otherwise delete any other account's picture.
            if (ownership.getProjectId() == null || !ownership.getProjectId().equals(projectId)) {
                throw new ValidationException("Attachment does not belong to this project");
            }
        }
    }

    // ======================== Deleting ========================

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

    /**
     * Best-effort deletion of several files. Callers use this <em>after</em> their transaction
     * commits: unlinking a file is not transactional, so doing it first meant a later rollback
     * left rows pointing at files that no longer existed.
     */
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

    /**
     * Computes which files were removed from {@code before} and are absent in {@code after},
     * and deletes them after the current transaction commits.
     *
     * <p>Shared by task and project updates: both track attachment lists and need the same
     * diff-then-delete-after-commit logic.
     */
    public void deleteRemovedAfterCommit(List<String> before, List<String> after, String description) {
        var removed = new ArrayList<>(before);
        removed.removeAll(new HashSet<>(after));
        if (removed.isEmpty()) {
            return;
        }
        AfterCommit.run(description, () -> deleteFilesSilently(removed));
    }

    // ======================== Reading ========================

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

    // ======================== Internals ========================

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
        if (file.getSize() > FileValidationConstants.MAX_FILE_SIZE) {
            throw new ValidationException("File size exceeds maximum allowed size of 5 MB");
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

    /** Reads only the header: identifying a type needs a few bytes, not the whole upload. */
    private void validateMagicBytes(MultipartFile file, byte[] expectedMagicBytes) {
        try (var input = file.getInputStream()) {
            var header = input.readNBytes(FileValidationConstants.MAGIC_BYTE_PREFIX_LENGTH);
            if (!FileValidationConstants.startsWithMagicBytes(header, expectedMagicBytes)) {
                throw new ValidationException("File content doesn't match declared type");
            }
        } catch (IOException e) {
            throw new FileStorageException("Could not validate file content");
        }
    }
}
