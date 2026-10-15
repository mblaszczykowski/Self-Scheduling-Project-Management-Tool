package com.backend.integration;

import com.backend.entities.User;
import com.backend.repositories.StoredFileRepository;
import com.backend.repositories.UserRepository;
import com.backend.services.FileStorageService;
import com.backend.services.TokenService;
import com.backend.util.AfterCommit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityLifecycleIntegrationTest extends PostgresIntegrationTest {
    @Autowired UserRepository users;
    @Autowired StoredFileRepository storedFiles;
    @Autowired com.backend.repositories.ProjectRepository projects;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Autowired TokenService tokens;
    @Autowired com.backend.services.SseEmitterManager streams;
    @Autowired FileStorageService files;
    @Autowired PlatformTransactionManager transactions;
    private Integer userId;
    private Integer projectId;
    private String projectUpload;

    private int createUser() {
        var user = users.save(new User("Test", "Security", UUID.randomUUID() + "@example.com", "unused"));
        userId = user.getId();
        return userId;
    }

    @AfterEach
    void cleanUp() {
        if (projectId != null) jdbc.update("DELETE FROM projects WHERE id = ?", projectId);
        if (projectUpload != null) files.deleteFile(projectUpload);
        if (userId != null) users.deleteById(userId);
    }

    @Test
    void rotationPreservesConcurrentAccessButLogoutRevokesEveryTokenInTheFamily() throws Exception {
        var id = createUser();
        var original = tokens.createAuthTokens(id);
        assertThat(tokens.validateTokenAndGetUserId(original.accessCookie().getValue())).isEqualTo(id);

        var rotation = tokens.rotateRefreshToken(original.refreshCookie().getValue());
        assertThat(rotation.succeeded()).isTrue();
        var rotated = tokens.buildCookies(id, rotation.refreshToken());
        assertThat(tokens.validateTokenAndGetUserId(original.accessCookie().getValue())).isEqualTo(id);
        assertThat(tokens.validateTokenAndGetUserId(rotated.accessCookie().getValue())).isEqualTo(id);

        var stream = streams.createEmitter(id);
        tokens.revokeRefreshToken(rotation.refreshToken());
        var completed = org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter.class.getDeclaredField("complete");
        completed.setAccessible(true);
        assertThat(completed.getBoolean(stream)).isTrue();
        assertThat(tokens.validateTokenAndGetUserId(original.accessCookie().getValue())).isNull();
        assertThat(tokens.validateTokenAndGetUserId(rotated.accessCookie().getValue())).isNull();
    }

    @Test
    void replayAndPasswordSessionRevocationInvalidateAccessImmediately() {
        var id = createUser();
        var first = tokens.createAuthTokens(id);
        var second = tokens.createAuthTokens(id);
        var rotation = tokens.rotateRefreshToken(first.refreshCookie().getValue());
        assertThat(rotation.succeeded()).isTrue();
        assertThat(tokens.rotateRefreshToken(first.refreshCookie().getValue()).succeeded()).isFalse();
        assertThat(tokens.validateTokenAndGetUserId(first.accessCookie().getValue())).isNull();
        assertThat(tokens.validateTokenAndGetUserId(second.accessCookie().getValue())).isEqualTo(id);
        tokens.revokeAllSessionsForUser(id);
        assertThat(tokens.validateTokenAndGetUserId(second.accessCookie().getValue())).isNull();
    }

    @Test
    void rollingBackAnUploadRemovesBytesAndOwnership() {
        var id = createUser();
        var url = new AtomicReference<String>();
        var path = new AtomicReference<Path>();
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            url.set(files.storeFile(upload(), null, id));
            path.set(files.getFilePath(FileStorageService.extractFileName(url.get())));
            assertThat(path.get()).exists();
            status.setRollbackOnly();
        });
        assertThat(path.get()).doesNotExist();
        assertThat(storedFiles.findByStoredName(FileStorageService.extractFileName(url.get()))).isEmpty();
    }

    @Test
    void postCommitCleanupPreservesReferencesAndCommitsMetadataDeletionAfterTheLastReference() {
        var id = createUser();
        var url = new AtomicReference<String>();
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            url.set(files.storeFile(upload(), null, id));
            users.findById(id).orElseThrow().setProfilePicture(url.get());
        });
        var name = FileStorageService.extractFileName(url.get());
        var path = files.getFilePath(name);
        files.deleteFilesSilently(List.of(url.get()));
        assertThat(path).exists();
        assertThat(storedFiles.findByStoredName(name)).isPresent();

        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            users.findById(id).orElseThrow().setProfilePicture(null);
            AfterCommit.run("test profile cleanup", () -> files.deleteFilesSilently(List.of(url.get())));
        });
        assertThat(path).doesNotExist();
        assertThat(storedFiles.findByStoredName(name)).isEmpty();
    }

    private static MockMultipartFile upload() {
        return new MockMultipartFile("file", "test.txt", "text/plain", "security test".getBytes(StandardCharsets.UTF_8));
    }
    @Test
    void sweepRetriesOldUnreferencedUploadsEvenWhenOwnershipMetadataSurvived() throws Exception {
        var id = createUser();
        var url = files.storeFile(upload(), null, id);
        var name = FileStorageService.extractFileName(url);
        var path = files.getFilePath(name);
        java.nio.file.Files.setLastModifiedTime(path, java.nio.file.attribute.FileTime.from(
                java.time.Instant.now().minus(java.time.Duration.ofDays(2))));
        assertThat(storedFiles.findByStoredName(name)).isPresent();
        assertThat(files.deleteUnreferencedFiles(java.time.Duration.ofHours(6))).isPositive();
        assertThat(path).doesNotExist();
        assertThat(storedFiles.findByStoredName(name)).isEmpty();
    }

    @Test
    void cleanupWaitsForAConcurrentTransactionReusingTheSameAttachment() throws Exception {
        var id = createUser();
        var project = new com.backend.entities.Project();
        project.setProjectKey("LOCK" + UUID.randomUUID().toString().substring(0, 8));
        project.setSummary("Attachment lock regression");
        project.setOwner(users.findById(id).orElseThrow());
        projectId = projects.save(project).getId();
        projectUpload = files.storeFile(upload(), projectId, id);
        var path = files.getFilePath(FileStorageService.extractFileName(projectUpload));
        var validated = new java.util.concurrent.CountDownLatch(1);
        var commitAllowed = new java.util.concurrent.CountDownLatch(1);
        var cleanupStarted = new java.util.concurrent.CountDownLatch(1);
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var attaching = pool.submit(() -> new TransactionTemplate(transactions).executeWithoutResult(status -> {
                files.requireAttachmentsBelongTo(projectId, List.of(projectUpload));
                jdbc.update("INSERT INTO project_attachments (project_id, attachment_url) VALUES (?, ?)", projectId, projectUpload);
                validated.countDown();
                try {
                    if (!commitAllowed.await(10, java.util.concurrent.TimeUnit.SECONDS)) {
                        throw new IllegalStateException("Timed out waiting to commit the attachment");
                    }
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException(ex);
                }
            }));
            try {
                assertThat(validated.await(10, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
                var cleanup = pool.submit(() -> {
                    cleanupStarted.countDown();
                    files.deleteFile(projectUpload);
                });
                assertThat(cleanupStarted.await(10, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
                org.assertj.core.api.Assertions.assertThatThrownBy(() -> cleanup.get(200, java.util.concurrent.TimeUnit.MILLISECONDS))
                        .isInstanceOf(java.util.concurrent.TimeoutException.class);
                commitAllowed.countDown();
                attaching.get(10, java.util.concurrent.TimeUnit.SECONDS);
                cleanup.get(10, java.util.concurrent.TimeUnit.SECONDS);
                assertThat(path).exists();
                assertThat(storedFiles.findByStoredName(FileStorageService.extractFileName(projectUpload))).isPresent();
            } finally {
                commitAllowed.countDown();
            }
        }
    }

}
