package com.backend.services;

import com.backend.TestEntityFactory;
import com.backend.entities.User;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.mapper.EntityMapper;
import com.backend.repositories.ProjectRepository;
import com.backend.repositories.UserRepository;
import com.backend.requests.EmailPreferencesRequest;
import com.backend.requests.UpdateProfileRequest;
import com.backend.requests.UserRegistrationRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserService")
class UserServiceTest {
    private static final String CURRENT_PASSWORD = "OldPass1!";

    @Mock
    private UserRepository userRepository;

    @Mock
    private TokenService tokenService;

    @Mock
    private FileStorageService fileStorageService;

    @Mock
    private ProjectRepository projectRepository;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4);
    private final EntityMapper entityMapper = new EntityMapper();

    private UserService userService;
    private User existingUser;

    @BeforeEach
    void setUp() {
        userService = new UserService(userRepository, tokenService, fileStorageService,
                projectRepository, passwordEncoder, entityMapper);

        existingUser = TestEntityFactory.createUser(7, "old@example.com");
        existingUser.setFirstname("Old");
        existingUser.setLastname("Name");
        existingUser.setPassword(passwordEncoder.encode(CURRENT_PASSWORD));
    }

    @Nested
    @DisplayName("registerUser")
    class RegisterUser {
        @Test
        @DisplayName("stores the email address lower-cased and trimmed, and trims the names")
        void storesTheEmailLowerCasedAndTrimmed() {
            var request = new UserRegistrationRequest("  Ada ", " Lovelace  ",
                    "  Ada@Example.COM  ", "Password1!");
            when(userRepository.existsByEmailIgnoringCase("ada@example.com")).thenReturn(false);
            when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
                User saved = invocation.getArgument(0);
                saved.setId(42);
                return saved;
            });

            var result = userService.registerUser(request);

            var savedUser = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(savedUser.capture());
            assertThat(savedUser.getValue().getEmail()).isEqualTo("ada@example.com");
            assertThat(savedUser.getValue().getFirstname()).isEqualTo("Ada");
            assertThat(savedUser.getValue().getLastname()).isEqualTo("Lovelace");
            assertThat(result.email()).isEqualTo("ada@example.com");
            assertThat(result.userId()).isEqualTo(42);
        }

        @Test
        @DisplayName("stores the password as a hash that verifies against the submitted one")
        void storesThePasswordAsAVerifiableHash() {
            var request = new UserRegistrationRequest("Ada", "Lovelace",
                    "ada@example.com", "Password1!");
            when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

            userService.registerUser(request);

            var savedUser = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(savedUser.capture());
            assertThat(savedUser.getValue().getPassword()).isNotEqualTo("Password1!");
            assertThat(passwordEncoder.matches("Password1!", savedUser.getValue().getPassword())).isTrue();
        }

        @Test
        @DisplayName("rejects an address already registered under a different casing, without saying it is taken")
        void rejectsAnAddressAlreadyRegisteredUnderADifferentCasing() {
            var request = new UserRegistrationRequest("Ada", "Lovelace",
                    "ADA@Example.com", "Password1!");
            when(userRepository.existsByEmailIgnoringCase("ada@example.com")).thenReturn(true);

            assertThatThrownBy(() -> userService.registerUser(request))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Registration failed. Please check your details.");
            verify(userRepository, never()).save(any(User.class));
            verifyNoInteractions(tokenService);
        }

        @Test
        @DisplayName("rejects a password that does not meet the policy before touching the database")
        void rejectsAWeakPassword() {
            var request = new UserRegistrationRequest("Ada", "Lovelace",
                    "ada@example.com", "password");

            assertThatThrownBy(() -> userService.registerUser(request))
                    .isInstanceOf(ValidationException.class);
            verify(userRepository, never()).save(any(User.class));
        }
    }

    @Nested
    @DisplayName("findUserByEmailOrNull")
    class FindUserByEmailOrNull {
        @Test
        @DisplayName("normalizes the address before looking it up")
        void normalizesTheAddressBeforeLookingItUp() {
            when(userRepository.findByEmailIgnoringCase("old@example.com"))
                    .thenReturn(Optional.of(existingUser));

            var found = userService.findUserByEmailOrNull("  OLD@Example.com  ");

            assertThat(found).isSameAs(existingUser);
            var queried = ArgumentCaptor.forClass(String.class);
            verify(userRepository).findByEmailIgnoringCase(queried.capture());
            assertThat(queried.getValue()).isEqualTo("old@example.com");
        }

        @Test
        @DisplayName("returns null instead of throwing when nobody has that address")
        void returnsNullWhenNobodyHasThatAddress() {
            when(userRepository.findByEmailIgnoringCase("ghost@example.com"))
                    .thenReturn(Optional.empty());

            assertThat(userService.findUserByEmailOrNull("Ghost@Example.com")).isNull();
        }
    }

    @Nested
    @DisplayName("findByEmailsAsMap")
    class FindByEmailsAsMap {
        @Test
        @DisplayName("keys the result by normalized email and skips blank entries")
        @SuppressWarnings("unchecked")
        void keysTheResultByNormalizedEmailAndSkipsBlanks() {
            var ada = TestEntityFactory.createUser(1, "Ada@Example.com");
            var bob = TestEntityFactory.createUser(2, "bob@example.com");
            when(userRepository.findByEmailInIgnoringCase(anyCollection()))
                    .thenReturn(List.of(ada, bob));

            var result = userService.findByEmailsAsMap(
                    List.of("  ADA@Example.com ", "bob@example.com", "   ", ""));

            assertThat(result).containsOnlyKeys("ada@example.com", "bob@example.com");
            assertThat(result.get("ada@example.com")).isSameAs(ada);

            var queried = ArgumentCaptor.forClass(Collection.class);
            verify(userRepository).findByEmailInIgnoringCase(queried.capture());
            assertThat((Collection<String>) queried.getValue())
                    .containsExactlyInAnyOrder("ada@example.com", "bob@example.com");
        }

        @Test
        @DisplayName("returns an empty map without querying when every address is blank")
        void returnsAnEmptyMapWhenEveryAddressIsBlank() {
            assertThat(userService.findByEmailsAsMap(List.of("  ", ""))).isEmpty();
            assertThat(userService.findByEmailsAsMap(List.of())).isEmpty();
            assertThat(userService.findByEmailsAsMap(null)).isEmpty();
            verifyNoInteractions(userRepository);
        }
    }

    @Nested
    @DisplayName("updateProfile")
    class UpdateProfile {
        @BeforeEach
        void stubLookup() {
            when(userRepository.findById(7)).thenReturn(Optional.of(existingUser));
        }

        @Test
        @DisplayName("refuses to change the email address without the current password")
        void refusesToChangeTheEmailWithoutTheCurrentPassword() {
            var request = new UpdateProfileRequest(null, null, "new@example.com", null, null);

            assertThatThrownBy(() -> userService.updateProfile(7, request, null))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Current password is required to change your email address");
            assertThat(existingUser.getEmail()).isEqualTo("old@example.com");
        }

        @Test
        @DisplayName("refuses to change the email address when the supplied current password is wrong")
        void refusesToChangeTheEmailWithAWrongCurrentPassword() {
            var request = new UpdateProfileRequest(null, null, "new@example.com", "NotIt1!x", null);

            assertThatThrownBy(() -> userService.updateProfile(7, request, null))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Current password is required to change your email address");
            assertThat(existingUser.getEmail()).isEqualTo("old@example.com");
        }

        @Test
        @DisplayName("changes the email address, normalized, once the current password is supplied")
        void changesTheEmailOnceTheCurrentPasswordIsSupplied() {
            var request = new UpdateProfileRequest(null, null, " New@Example.COM ",
                    CURRENT_PASSWORD, null);
            when(userRepository.existsByEmailIgnoringCase("new@example.com")).thenReturn(false);

            var dto = userService.updateProfile(7, request, null);

            assertThat(existingUser.getEmail()).isEqualTo("new@example.com");
            assertThat(dto.email()).isEqualTo("new@example.com");
            verify(tokenService, never()).revokeAllSessionsForUser(anyInt());
        }

        @Test
        @DisplayName("rejects an email address that somebody else already uses")
        void rejectsAnEmailAddressSomebodyElseUses() {
            var request = new UpdateProfileRequest(null, null, "taken@example.com",
                    CURRENT_PASSWORD, null);
            when(userRepository.existsByEmailIgnoringCase("taken@example.com")).thenReturn(true);

            assertThatThrownBy(() -> userService.updateProfile(7, request, null))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Email already in use");
            assertThat(existingUser.getEmail()).isEqualTo("old@example.com");
        }

        @Test
        @DisplayName("asks for no password when the submitted address differs from the current one only in casing")
        void asksForNoPasswordWhenTheAddressOnlyDiffersInCasing() {
            var request = new UpdateProfileRequest(null, null, " OLD@Example.com ", null, null);

            assertThatCode(() -> userService.updateProfile(7, request, null))
                    .doesNotThrowAnyException();
            assertThat(existingUser.getEmail()).isEqualTo("old@example.com");
            verify(userRepository, never()).existsByEmailIgnoringCase(anyString());
        }

        @Test
        @DisplayName("refuses to change the password without the current one, and leaves the stored hash intact")
        void refusesToChangeThePasswordWithoutTheCurrentOne() {
            var request = new UpdateProfileRequest(null, null, null, null, "NewPass1!");

            assertThatThrownBy(() -> userService.updateProfile(7, request, null))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Current password is required to change your password");
            assertThat(passwordEncoder.matches(CURRENT_PASSWORD, existingUser.getPassword())).isTrue();
            verify(tokenService, never()).revokeAllSessionsForUser(anyInt());
        }

        @Test
        @DisplayName("changes the password and revokes every existing session")
        void changesThePasswordAndRevokesEverySession() {
            var request = new UpdateProfileRequest(null, null, null, CURRENT_PASSWORD, "NewPass1!");

            userService.updateProfile(7, request, null);

            assertThat(passwordEncoder.matches("NewPass1!", existingUser.getPassword())).isTrue();
            assertThat(passwordEncoder.matches(CURRENT_PASSWORD, existingUser.getPassword())).isFalse();
            verify(tokenService).revokeAllSessionsForUser(7);
        }

        @Test
        @DisplayName("rejects a new password that does not meet the policy and keeps the old hash")
        void rejectsANewPasswordThatDoesNotMeetThePolicy() {
            var request = new UpdateProfileRequest(null, null, null, CURRENT_PASSWORD, "alllowercase");

            assertThatThrownBy(() -> userService.updateProfile(7, request, null))
                    .isInstanceOf(ValidationException.class);
            assertThat(passwordEncoder.matches(CURRENT_PASSWORD, existingUser.getPassword())).isTrue();
            verify(tokenService, never()).revokeAllSessionsForUser(anyInt());
        }

        @Test
        @DisplayName("leaves every session alone when neither the password nor the email changes")
        void leavesEverySessionAloneWhenNeitherCredentialChanges() {
            var request = new UpdateProfileRequest(" Grace ", " Hopper ", null, null, null);

            var dto = userService.updateProfile(7, request, null);

            assertThat(existingUser.getFirstname()).isEqualTo("Grace");
            assertThat(existingUser.getLastname()).isEqualTo("Hopper");
            assertThat(dto.firstname()).isEqualTo("Grace");
            verify(tokenService, never()).revokeAllSessionsForUser(anyInt());
            verifyNoInteractions(fileStorageService);
        }

        @Test
        @DisplayName("leaves blank name fields untouched rather than blanking the profile")
        void leavesBlankNameFieldsUntouched() {
            var request = new UpdateProfileRequest("   ", "", null, null, null);

            userService.updateProfile(7, request, null);

            assertThat(existingUser.getFirstname()).isEqualTo("Old");
            assertThat(existingUser.getLastname()).isEqualTo("Name");
        }

        @Test
        @DisplayName("refuses a profile picture whose content type is not an image")
        void refusesAProfilePictureWhoseContentTypeIsNotAnImage() {
            var upload = new MockMultipartFile("profilePicture", "resume.pdf", "application/pdf",
                    "%PDF-1.4".getBytes(StandardCharsets.UTF_8));
            var request = new UpdateProfileRequest(null, null, null, null, null);

            assertThatThrownBy(() -> userService.updateProfile(7, request, upload))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Invalid file type. Only images are allowed");
            verifyNoInteractions(fileStorageService);
        }

        @Test
        @DisplayName("refuses a profile picture whose bytes do not match an image's magic prefix")
        void refusesAProfilePictureWhoseBytesDoNotMatchAnImageMagicPrefix() {
            var upload = new MockMultipartFile("profilePicture", "fake.png", "image/png",
                    "not actually a png".getBytes(StandardCharsets.UTF_8));
            var request = new UpdateProfileRequest(null, null, null, null, null);

            assertThatThrownBy(() -> userService.updateProfile(7, request, upload))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("doesn't match image type");
            verifyNoInteractions(fileStorageService);
        }

        @Test
        @DisplayName("accepts a valid PNG and stores it as the user's profile picture")
        void acceptsAValidPngAndStoresItAsTheProfilePicture() {
            var upload = new MockMultipartFile("profilePicture", "avatar.png", "image/png",
                    new byte[]{(byte) 0x89, 'P', 'N', 'G'});
            var request = new UpdateProfileRequest(null, null, null, null, null);
            when(fileStorageService.storeFile(upload, null, 7)).thenReturn("/files/generated.png");

            var dto = userService.updateProfile(7, request, upload);

            assertThat(dto.profilePicture()).isEqualTo("/files/generated.png");
            verify(fileStorageService).storeFile(upload, null, 7);
        }
    }

    @Nested
    @DisplayName("getUserByEmailForRequester")
    class GetUserByEmailForRequester {
        @Test
        @DisplayName("returns the member-safe view of somebody the requester shares a project with")
        void returnsTheMemberSafeViewOfAProjectPartner() {
            var other = TestEntityFactory.createUser(9, "other@example.com");
            when(userRepository.findByEmailIgnoringCase("other@example.com"))
                    .thenReturn(Optional.of(other));
            when(projectRepository.doUsersShareProject(7, 9)).thenReturn(true);

            var dto = userService.getUserByEmailForRequester("Other@Example.com", 7);

            assertThat(dto.id()).isEqualTo(9);
            assertThat(dto.email()).isEqualTo("other@example.com");
            assertThat(dto.firstname()).isEqualTo(other.getFirstname());
        }

        @Test
        @DisplayName("returns the requester's own record without consulting shared projects")
        void returnsTheRequestersOwnRecordWithoutConsultingSharedProjects() {
            when(userRepository.findByEmailIgnoringCase("old@example.com"))
                    .thenReturn(Optional.of(existingUser));

            var dto = userService.getUserByEmailForRequester("OLD@example.com", 7);

            assertThat(dto.id()).isEqualTo(7);
            verify(projectRepository, never()).doUsersShareProject(anyInt(), anyInt());
        }

        @Test
        @DisplayName("hides a stranger behind exactly the same not-found as an address nobody uses")
        void hidesAStrangerBehindTheSameNotFoundAsAnUnusedAddress() {
            var stranger = TestEntityFactory.createUser(9, "stranger@example.com");
            when(userRepository.findByEmailIgnoringCase("stranger@example.com"))
                    .thenReturn(Optional.of(stranger));
            when(projectRepository.doUsersShareProject(7, 9)).thenReturn(false);
            when(userRepository.findByEmailIgnoringCase("ghost@example.com"))
                    .thenReturn(Optional.empty());

            var hidden = catchThrowable(
                    () -> userService.getUserByEmailForRequester("stranger@example.com", 7));
            var missing = catchThrowable(
                    () -> userService.getUserByEmailForRequester("ghost@example.com", 7));

            assertThat(hidden).isInstanceOf(ResourceNotFoundException.class);
            assertThat(missing).isInstanceOf(ResourceNotFoundException.class);
            assertThat(hidden).hasMessage("User not found");
            assertThat(hidden).hasMessage(missing.getMessage());
        }
    }

    @Nested
    @DisplayName("updateEmailPreferences")
    class UpdateEmailPreferences {
        @Test
        @DisplayName("changes only the flags the request actually carries")
        void changesOnlyTheFlagsTheRequestCarries() {
            existingUser.setEmailNotificationsEnabled(true);
            existingUser.setEmailOnTaskAssigned(true);
            existingUser.setEmailOnCommentReply(true);
            existingUser.setEmailOnProjectInvitation(true);
            when(userRepository.findById(7)).thenReturn(Optional.of(existingUser));

            var dto = userService.updateEmailPreferences(7,
                    new EmailPreferencesRequest(null, false, null, null));

            assertThat(existingUser.getEmailOnTaskAssigned()).isFalse();
            assertThat(existingUser.getEmailNotificationsEnabled()).isTrue();
            assertThat(existingUser.getEmailOnCommentReply()).isTrue();
            assertThat(existingUser.getEmailOnProjectInvitation()).isTrue();
            assertThat(dto.emailOnTaskAssigned()).isFalse();
            assertThat(dto.emailNotificationsEnabled()).isTrue();
        }

        @Test
        @DisplayName("reports an unknown user id as not found")
        void reportsAnUnknownUserIdAsNotFound() {
            when(userRepository.findById(999)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> userService.updateEmailPreferences(999,
                    new EmailPreferencesRequest(false, false, false, false)))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessage("User not found");
        }
    }
}
