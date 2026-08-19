package com.backend.services;

import com.backend.config.AppProperties;
import com.backend.entities.StoredFile;
import com.backend.exception.ValidationException;
import com.backend.repositories.StoredFileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.autoconfigure.web.servlet.MultipartProperties;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.util.unit.DataSize;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FileStorageServiceTest {
    private static final Integer PROJECT_ID = 10;

    @Mock private StoredFileRepository storedFileRepository;

    private Path uploadDir;
    private AppProperties properties;
    private FileStorageService fileStorage;

    @BeforeEach
    void setUp(@TempDir Path uploadDir) {
        this.uploadDir = uploadDir;
        properties = new AppProperties();
        properties.getStorage().setUploadDir(uploadDir.toString());
        var multipartProperties = new MultipartProperties();
        multipartProperties.setMaxFileSize(DataSize.ofMegabytes(5));
        fileStorage = new FileStorageService(properties, storedFileRepository, multipartProperties);
    }

    private FileStorageService fileStorageWithMaxSize(DataSize maxSize) {
        var multipartProperties = new MultipartProperties();
        multipartProperties.setMaxFileSize(maxSize);
        return new FileStorageService(properties, storedFileRepository, multipartProperties);
    }

    private static MockMultipartFile multipartFile(String originalFilename, String contentType, byte[] content) {
        return new MockMultipartFile("file", originalFilename, contentType, content);
    }

    private static void ageFile(Path path, Duration age) throws IOException {
        Files.setLastModifiedTime(path, FileTime.from(Instant.now().minus(age)));
    }

    private static StoredFile ownedBy(String name, Integer projectId) {
        return new StoredFile(name, projectId, 1);
    }

    private void repositoryHolds(StoredFile... files) {
        when(storedFileRepository.findByStoredNameIn(anyCollection())).thenReturn(List.of(files));
    }

    @Nested
    @DisplayName("Storing a file")
    class StoringAFile {
        @Test
        @DisplayName("a disallowed extension is refused")
        void disallowedExtensionIsRefused() {
            var upload = multipartFile("malware.exe", "application/octet-stream", new byte[]{1, 2, 3});

            assertThatThrownBy(() -> fileStorage.storeFile(upload, PROJECT_ID, 1))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("not allowed");
        }

        @Test
        @DisplayName("svg is refused, as documented, since it would turn an upload into stored XSS")
        void svgIsRefused() {
            var upload = multipartFile("image.svg", "image/svg+xml",
                    "<svg onload=\"alert(1)\"></svg>".getBytes(StandardCharsets.UTF_8));

            assertThatThrownBy(() -> fileStorage.storeFile(upload, PROJECT_ID, 1))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("not allowed");
        }

        @Test
        @DisplayName("html is refused, as documented, since it would turn an upload into stored XSS")
        void htmlIsRefused() {
            var upload = multipartFile("page.html", "text/html",
                    "<script>alert(1)</script>".getBytes(StandardCharsets.UTF_8));

            assertThatThrownBy(() -> fileStorage.storeFile(upload, PROJECT_ID, 1))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("not allowed");
        }

        @Test
        @DisplayName("content that does not match the declared extension is refused")
        void contentNotMatchingTheDeclaredExtensionIsRefused() {
            var upload = multipartFile("fake.pdf", "application/pdf",
                    "just some text, not a pdf".getBytes(StandardCharsets.UTF_8));

            assertThatThrownBy(() -> fileStorage.storeFile(upload, PROJECT_ID, 1))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("doesn't match declared type");
        }

        @Test
        @DisplayName("a file over the configured maximum size is refused")
        void oversizedFileIsRefused() {
            var tinyLimit = fileStorageWithMaxSize(DataSize.ofBytes(4));
            var upload = multipartFile("small.txt", "text/plain",
                    "this content is way too big".getBytes(StandardCharsets.UTF_8));

            assertThatThrownBy(() -> tinyLimit.storeFile(upload, PROJECT_ID, 1))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("exceeds maximum");
        }

        @Test
        @DisplayName("a file with no extension is refused")
        void fileWithNoExtensionIsRefused() {
            var upload = multipartFile("noextension", "text/plain",
                    "content".getBytes(StandardCharsets.UTF_8));

            assertThatThrownBy(() -> fileStorage.storeFile(upload, PROJECT_ID, 1))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("extension");
        }

        @Test
        @DisplayName("a valid file is written to disk under a generated name, not the client's filename")
        void validFileIsWrittenUnderAGeneratedName() {
            var upload = multipartFile("report.pdf", "application/pdf",
                    "%PDF-1.4 not a real pdf but starts right".getBytes(StandardCharsets.UTF_8));

            var url = fileStorage.storeFile(upload, PROJECT_ID, 1);

            assertThat(url).startsWith("/files/").endsWith(".pdf");
            var storedName = url.substring("/files/".length());
            assertThat(storedName).doesNotContain("report");
            assertThatCode(() -> UUID.fromString(storedName.substring(0, storedName.length() - ".pdf".length())))
                    .doesNotThrowAnyException();
            assertThat(uploadDir.resolve(storedName)).exists();

            var savedFile = ArgumentCaptor.forClass(StoredFile.class);
            verify(storedFileRepository).save(savedFile.capture());
            assertThat(savedFile.getValue().getStoredName()).isEqualTo(storedName);
            assertThat(savedFile.getValue().getProjectId()).isEqualTo(PROJECT_ID);
        }
    }

    @Nested
    @DisplayName("Storing a batch of files")
    class StoringABatchOfFiles {
        @Test
        @DisplayName("a later file failing validation leaves nothing from the batch on disk")
        void aLaterFileFailingValidationLeavesNothingWritten() throws IOException {
            var validPng = multipartFile("valid.png", "image/png", new byte[]{(byte) 0x89, 'P', 'N', 'G'});
            var badPdf = multipartFile("bad.pdf", "application/pdf",
                    "not a pdf".getBytes(StandardCharsets.UTF_8));

            assertThatThrownBy(() -> fileStorage.storeFiles(List.of(validPng, badPdf), PROJECT_ID, 1))
                    .isInstanceOf(ValidationException.class);

            try (var entries = Files.list(uploadDir)) {
                assertThat(entries).isEmpty();
            }
            verify(storedFileRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("Sweeping unreferenced files")
    class SweepingUnreferencedFiles {
        @Test
        @DisplayName("a file with an ownership row survives regardless of age")
        void fileWithOwnershipRowSurvives() throws IOException {
            var owned = uploadDir.resolve("owned.png");
            Files.writeString(owned, "content");
            ageFile(owned, Duration.ofDays(2));
            when(storedFileRepository.findAllStoredNames()).thenReturn(Set.of("owned.png"));

            var deleted = fileStorage.deleteUnreferencedFiles(Duration.ofHours(1));

            assertThat(deleted).isZero();
            assertThat(owned).exists();
        }

        @Test
        @DisplayName("an unreferenced file older than the minimum age is deleted")
        void oldEnoughUnreferencedFileIsDeleted() throws IOException {
            var orphan = uploadDir.resolve("orphan.png");
            Files.writeString(orphan, "content");
            ageFile(orphan, Duration.ofDays(2));
            when(storedFileRepository.findAllStoredNames()).thenReturn(Set.of());

            var deleted = fileStorage.deleteUnreferencedFiles(Duration.ofHours(1));

            assertThat(deleted).isEqualTo(1);
            assertThat(orphan).doesNotExist();
        }

        @Test
        @DisplayName("an unreferenced file younger than the minimum age survives, keeping an in-flight upload safe")
        void youngUnreferencedFileSurvives() throws IOException {
            var inFlight = uploadDir.resolve("in-flight.png");
            Files.writeString(inFlight, "content");
            when(storedFileRepository.findAllStoredNames()).thenReturn(Set.of());

            var deleted = fileStorage.deleteUnreferencedFiles(Duration.ofHours(1));

            assertThat(deleted).isZero();
            assertThat(inFlight).exists();
        }

        @Test
        @DisplayName("a missing upload directory returns 0 rather than throwing")
        void missingUploadDirectoryReturnsZero() throws IOException {
            var vanishedDir = uploadDir.resolve("vanished");
            var props = new AppProperties();
            props.getStorage().setUploadDir(vanishedDir.toString());
            var service = new FileStorageService(props, storedFileRepository, new MultipartProperties());
            Files.delete(vanishedDir);

            assertThat(service.deleteUnreferencedFiles(Duration.ofHours(1))).isZero();
        }
    }

    @Nested
    @DisplayName("Declaring an attachment on a project")
    class DeclaringAttachments {
        @Test
        @DisplayName("a file already owned by that project is accepted")
        void ownFileIsAccepted() {
            repositoryHolds(ownedBy("own.png", PROJECT_ID));

            assertThatCode(() -> fileStorage.requireAttachmentsBelongTo(
                    PROJECT_ID, List.of("/files/own.png"))).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("a file owned by another project is refused")
        void otherProjectsFileIsRefused() {
            repositoryHolds(ownedBy("theirs.png", 99));

            assertThatThrownBy(() -> fileStorage.requireAttachmentsBelongTo(
                    PROJECT_ID, List.of("/files/theirs.png")))
                    .isInstanceOf(ValidationException.class);
        }

        @Test
        @DisplayName("someone else's profile picture cannot be claimed as an attachment")
        void unscopedProfilePictureIsRefused() {
            repositoryHolds(ownedBy("victim-avatar.png", null));

            assertThatThrownBy(() -> fileStorage.requireAttachmentsBelongTo(
                    PROJECT_ID, List.of("/files/victim-avatar.png")))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("does not belong");
        }

        @Test
        @DisplayName("a file with no ownership row is refused, not trusted")
        void fileWithoutOwnershipIsRefused() {
            when(storedFileRepository.findByStoredNameIn(anyCollection())).thenReturn(List.of());

            assertThatThrownBy(() -> fileStorage.requireAttachmentsBelongTo(
                    PROJECT_ID, List.of("/files/unknown.png")))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("does not belong to this project");
        }

        @Test
        @DisplayName("declaring nothing asks the database nothing")
        void emptyDeclarationIsANoOp() {
            assertThatCode(() -> fileStorage.requireAttachmentsBelongTo(PROJECT_ID, List.of()))
                    .doesNotThrowAnyException();
            org.mockito.Mockito.verifyNoInteractions(storedFileRepository);
        }
    }

    @Nested
    @DisplayName("Resolving the attachment list for an update")
    class ResolvingAttachments {
        @Test
        @DisplayName("keeps a declared attachment that already belongs to the project")
        void keepsAnAlreadyOwnedDeclaredAttachment() {
            repositoryHolds(ownedBy("keep.png", PROJECT_ID));

            var resolved = fileStorage.resolveAttachments(
                    PROJECT_ID, List.of("/files/keep.png"), List.of(), 1);

            assertThat(resolved).containsExactly("/files/keep.png");
        }

        @Test
        @DisplayName("refuses a declared attachment stolen from another project, storing nothing")
        void refusesAForeignDeclaredAttachment() {
            repositoryHolds(ownedBy("theirs.png", 99));

            assertThatThrownBy(() -> fileStorage.resolveAttachments(
                    PROJECT_ID, List.of("/files/theirs.png"), List.of(), 1))
                    .isInstanceOf(ValidationException.class);
        }
    }

    @Test
    @DisplayName("the ownership row is removed along with the file")
    void deletingAFileRemovesItsOwnershipRow() {
        fileStorage.deleteFile("/files/gone.png");

        org.mockito.Mockito.verify(storedFileRepository).deleteByStoredNameIn(Set.of("gone.png"));
    }
}
