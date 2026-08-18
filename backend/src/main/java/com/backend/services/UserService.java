package com.backend.services;

import com.backend.dtos.CurrentUserDTO;
import com.backend.dtos.UserDTO;
import com.backend.entities.User;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.mapper.EntityMapper;
import com.backend.repositories.ProjectRepository;
import com.backend.repositories.UserRepository;
import com.backend.requests.EmailPreferencesRequest;
import com.backend.requests.UpdateProfileRequest;
import com.backend.requests.UserRegistrationRequest;
import com.backend.util.AfterCommit;
import com.backend.util.FileValidationConstants;
import com.backend.util.ValidationUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Collection;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private final UserRepository userRepository;
    private final TokenService tokenService;
    private final FileStorageService fileStorageService;
    private final ProjectRepository projectRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final EntityMapper entityMapper;

    public UserService(UserRepository userRepository,
                       TokenService tokenService,
                       FileStorageService fileStorageService,
                       ProjectRepository projectRepository,
                       BCryptPasswordEncoder passwordEncoder,
                       EntityMapper entityMapper) {
        this.userRepository = userRepository;
        this.tokenService = tokenService;
        this.fileStorageService = fileStorageService;
        this.projectRepository = projectRepository;
        this.passwordEncoder = passwordEncoder;
        this.entityMapper = entityMapper;
    }

    /** Canonical form of an email address: identity is case-insensitive and untrimmed input is a typo. */
    public static String normalizeEmail(String email) {
        return email == null ? null : email.toLowerCase(Locale.ROOT).trim();
    }

    public User findUserByEmailOrNull(String email) {
        return userRepository.findByEmailIgnoringCase(normalizeEmail(email)).orElse(null);
    }

    public User getRequiredUserById(Integer id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private User getRequiredUserByEmail(String email) {
        return userRepository.findByEmailIgnoringCase(normalizeEmail(email))
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    /**
     * A member-safe view of another user, visible only to people who share a project with them.
     * Returns the same "not found" as a nonexistent address, so the endpoint is not an oracle.
     */
    public UserDTO getUserByEmailForRequester(String email, Integer requesterId) {
        var user = getRequiredUserByEmail(email);
        boolean canAccessProfile = user.getId().equals(requesterId)
                || projectRepository.doUsersShareProject(requesterId, user.getId());
        if (!canAccessProfile) {
            throw new ResourceNotFoundException("User not found");
        }
        return entityMapper.toUserDTO(user);
    }

    /** @return the found users keyed by their normalized email; missing addresses are simply absent. */
    public Map<String, User> findByEmailsAsMap(Collection<String> emails) {
        if (emails == null || emails.isEmpty()) {
            return Map.of();
        }
        var normalized = emails.stream()
                .map(UserService::normalizeEmail)
                .filter(email -> email != null && !email.isEmpty())
                .collect(Collectors.toSet());
        if (normalized.isEmpty()) {
            return Map.of();
        }
        return userRepository.findByEmailInIgnoringCase(normalized).stream()
                .collect(Collectors.toMap(user -> normalizeEmail(user.getEmail()), Function.identity()));
    }

    public CurrentUserDTO getCurrentUser(Integer userId) {
        return entityMapper.toCurrentUserDTO(getRequiredUserById(userId));
    }

    public record RegistrationResult(TokenService.AuthTokens tokens, Integer userId, String email) {}

    @Transactional(rollbackFor = Exception.class)
    public RegistrationResult registerUser(UserRegistrationRequest request) {
        var email = normalizeEmail(request.email());
        if (userRepository.existsByEmailIgnoringCase(email)) {
            // Deliberately vague: a precise "email already registered" is an enumeration oracle.
            throw new ValidationException("Registration failed. Please check your details.");
        }
        ValidationUtil.validatePassword(request.password());

        var user = new User(
                request.firstname().trim(),
                request.lastname().trim(),
                email,
                passwordEncoder.encode(request.password())
        );
        userRepository.save(user);
        log.info("Registered user {}", user.getId());

        return new RegistrationResult(tokenService.createAuthTokens(user.getId()), user.getId(), user.getEmail());
    }

    /**
     * Applies profile changes. Blank fields are left alone.
     *
     * <p>Both credential-bearing changes — the password and the email address — require the
     * current password, and a password change revokes every existing session.
     */
    @Transactional(rollbackFor = Exception.class)
    public CurrentUserDTO updateProfile(Integer userId,
                                        UpdateProfileRequest request,
                                        MultipartFile profilePicture) {
        var user = getRequiredUserById(userId);
        boolean passwordChanged = false;

        if (!ValidationUtil.isNullOrEmpty(request.firstname())) {
            ValidationUtil.validateName(request.firstname(), "First name");
            user.setFirstname(request.firstname().trim());
        }

        if (!ValidationUtil.isNullOrEmpty(request.lastname())) {
            ValidationUtil.validateName(request.lastname(), "Last name");
            user.setLastname(request.lastname().trim());
        }

        var newEmail = normalizeEmail(request.email());
        if (newEmail != null && !newEmail.isEmpty() && !newEmail.equals(user.getEmail())) {
            if (!ValidationUtil.isValidEmail(newEmail)) {
                throw new ValidationException("Invalid email format");
            }
            requireCurrentPassword(user, request.currentPassword(),
                    "Current password is required to change your email address");
            if (userRepository.existsByEmailIgnoringCase(newEmail)) {
                throw new ValidationException("Email already in use");
            }
            user.setEmail(newEmail);
        }

        if (!ValidationUtil.isNullOrEmpty(request.newPassword())) {
            requireCurrentPassword(user, request.currentPassword(),
                    "Current password is required to change your password");
            ValidationUtil.validatePassword(request.newPassword());
            user.setPassword(passwordEncoder.encode(request.newPassword()));
            passwordChanged = true;
        }

        if (profilePicture != null && !profilePicture.isEmpty()) {
            validateProfilePictureUpload(profilePicture);
            replaceProfilePicture(user, profilePicture);
        }

        if (passwordChanged) {
            // The whole point of changing a password after a compromise is to end the other
            // party's access; leaving their 7-day refresh token alive would defeat it.
            tokenService.revokeAllSessionsForUser(userId);
            log.info("Password changed for user {} - all sessions revoked", userId);
        }

        return entityMapper.toCurrentUserDTO(user);
    }

    @Transactional(rollbackFor = Exception.class)
    public CurrentUserDTO updateEmailPreferences(Integer userId, EmailPreferencesRequest request) {
        var user = getRequiredUserById(userId);

        if (request.emailNotificationsEnabled() != null) {
            user.setEmailNotificationsEnabled(request.emailNotificationsEnabled());
        }
        if (request.emailOnTaskAssigned() != null) {
            user.setEmailOnTaskAssigned(request.emailOnTaskAssigned());
        }
        if (request.emailOnCommentReply() != null) {
            user.setEmailOnCommentReply(request.emailOnCommentReply());
        }
        if (request.emailOnProjectInvitation() != null) {
            user.setEmailOnProjectInvitation(request.emailOnProjectInvitation());
        }

        return entityMapper.toCurrentUserDTO(user);
    }

    private void requireCurrentPassword(User user, String currentPassword, String message) {
        if (ValidationUtil.isNullOrEmpty(currentPassword)
                || !passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new ValidationException(message);
        }
    }

    private void validateProfilePictureUpload(MultipartFile profilePicture) {
        var contentType = profilePicture.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new ValidationException("Invalid file type. Only images are allowed");
        }
        validateImageMagicBytes(profilePicture);
    }

    private void replaceProfilePicture(User user, MultipartFile profilePicture) {
        var oldPicture = user.getProfilePicture();
        // Not project-scoped: a profile picture is visible wherever its owner is.
        user.setProfilePicture(fileStorageService.storeFile(profilePicture, null, user.getId()));
        if (oldPicture != null) {
            // Deferred like every other unlink: deleting inside the transaction meant a later
            // rollback restored the row's pointer to a file that no longer existed, which is the
            // exact failure AfterCommit was introduced to remove. An orphaned old file is harmless
            // by comparison, so this stays best-effort.
            AfterCommit.run("delete replaced profile picture",
                    () -> fileStorageService.deleteFilesSilently(java.util.List.of(oldPicture)));
        }
    }

    private void validateImageMagicBytes(MultipartFile file) {
        try (var input = file.getInputStream()) {
            // Only the header is needed; reading a 5 MB upload into the heap to inspect four
            // bytes was pure waste.
            var header = input.readNBytes(FileValidationConstants.MAGIC_BYTE_PREFIX_LENGTH);
            if (!FileValidationConstants.isValidImageByMagicBytes(header)) {
                throw new ValidationException("File content doesn't match image type. Upload a valid image file.");
            }
        } catch (IOException e) {
            throw new ValidationException("Could not validate image file");
        }
    }
}
