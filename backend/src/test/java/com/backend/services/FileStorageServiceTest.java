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
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.file.Path;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.when;

/**
 * Which files a caller is allowed to declare as an attachment.
 *
 * <p>This is an authorization boundary, not bookkeeping: whoever may attach a file may also detach
 * it, and detaching unlinks it from disk.
 */
@ExtendWith(MockitoExtension.class)
class FileStorageServiceTest {

    private static final Integer PROJECT_ID = 10;

    @Mock private StoredFileRepository storedFileRepository;

    private FileStorageService fileStorage;

    @BeforeEach
    void setUp(@TempDir Path uploadDir) {
        var properties = new AppProperties();
        properties.getStorage().setUploadDir(uploadDir.toString());
        fileStorage = new FileStorageService(properties, storedFileRepository);
    }

    private static StoredFile ownedBy(String name, Integer projectId) {
        return new StoredFile(name, projectId, 1);
    }

    private void repositoryHolds(StoredFile... files) {
        when(storedFileRepository.findByStoredNameIn(anyCollection())).thenReturn(List.of(files));
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

        /**
         * A profile picture is stored with no project, and its URL travels in every
         * {@code UserDTO}, so any member can read one. Letting it be claimed as a task attachment
         * handed its deletion to the claimer: attach the victim's picture to a task in your own
         * project, remove the attachment, and the file is unlinked from disk.
         */
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
        @DisplayName("a pre-V5 file with no ownership row stays editable")
        void legacyFileWithoutOwnershipIsAccepted() {
            // Deliberate: V5 recorded ownership going forward and did not backfill, so refusing
            // these would make every historic attachment impossible to re-save.
            when(storedFileRepository.findByStoredNameIn(anyCollection())).thenReturn(List.of());

            assertThatCode(() -> fileStorage.requireAttachmentsBelongTo(
                    PROJECT_ID, List.of("/files/legacy.png"))).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("declaring nothing asks the database nothing")
        void emptyDeclarationIsANoOp() {
            assertThatCode(() -> fileStorage.requireAttachmentsBelongTo(PROJECT_ID, List.of()))
                    .doesNotThrowAnyException();
            org.mockito.Mockito.verifyNoInteractions(storedFileRepository);
        }
    }

    @Test
    @DisplayName("the ownership row is removed along with the file")
    void deletingAFileRemovesItsOwnershipRow() {
        fileStorage.deleteFile("/files/gone.png");

        // The repository method is @Transactional for this reason: every caller reaches it from an
        // AfterCommit callback, where there is no surrounding transaction to join.
        org.mockito.Mockito.verify(storedFileRepository).deleteByStoredNameIn(Set.of("gone.png"));
    }
}
