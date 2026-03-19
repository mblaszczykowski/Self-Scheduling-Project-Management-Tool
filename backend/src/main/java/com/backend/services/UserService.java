package com.backend.services;

import com.backend.dtos.UserDTO;
import com.backend.entities.User;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.repositories.ProjectRepository;
import com.backend.repositories.UserRepository;
import com.backend.requests.UserRegistrationRequest;
import com.backend.util.FileValidationConstants;
import com.backend.util.ValidationUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Collection;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final TokenService tokenService;
    private final FileStorageService fileStorageService;
    private final ProjectRepository projectRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    @Autowired
    public UserService(UserRepository userRepository,
                       TokenService tokenService,
                       FileStorageService fileStorageService,
                       ProjectRepository projectRepository,
                       BCryptPasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.tokenService = tokenService;
        this.fileStorageService = fileStorageService;
        this.projectRepository = projectRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public boolean shareProjectWith(Integer userId1, Integer userId2) {
        return projectRepository.doUsersShareProject(userId1, userId2);
    }

    public boolean existsUserByEmail(String email) {
        return userRepository.existsByEmail(email);
    }

    public User findUserByEmailOrNull(String email) {
        return userRepository.findByEmail(email).orElse(null);
    }

    public User getRequiredUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    public User getRequiredUserById(Integer id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    public Map<String, User> findByEmailsAsMap(Collection<String> emails) {
        if (emails == null || emails.isEmpty()) {
            return Map.of();
        }
        return userRepository.findByEmailIn(emails).stream()
                .collect(Collectors.toMap(User::getEmail, user -> user));
    }

    @Transactional
    public ResponseEntity<?> registerUser(UserRegistrationRequest request) {
        validateRegistrationRequest(request);
        ValidationUtil.validatePassword(request.password());
        ValidationUtil.validateName(request.firstname(), "First name");
        ValidationUtil.validateName(request.lastname(), "Last name");

        var hashedPassword = passwordEncoder.encode(request.password());

        var user = new User(
                request.firstname().trim(),
                request.lastname().trim(),
                request.email().toLowerCase().trim(),
                hashedPassword
        );

        userRepository.save(user);

        var tokens = tokenService.createAuthTokens(user.getId());

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, tokens.accessCookie().toString())
                .header(HttpHeaders.SET_COOKIE, tokens.refreshCookie().toString())
                .body(Map.of(
                        "message", "Registration successful",
                        "userId", user.getId(),
                        "email", user.getEmail()
                ));
    }

    public ResponseEntity<?> getUserDetails(Integer userId) {
        var user = getUserById(userId);
        var userDTO = new UserDTO(
                user.getId(),
                user.getFirstname(),
                user.getLastname(),
                user.getEmail(),
                user.getProfilePicture()
        );
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(userDTO);
    }

    @Transactional
    public UserDTO updateUser(Integer userId,
                              String firstname,
                              String lastname,
                              String email,
                              String currentPassword,
                              String newPassword,
                              MultipartFile profilePicture) {

        var user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!ValidationUtil.isNullOrEmpty(firstname)) {
            ValidationUtil.validateName(firstname, "First name");
            user.setFirstname(firstname.trim());
        }

        if (!ValidationUtil.isNullOrEmpty(lastname)) {
            ValidationUtil.validateName(lastname, "Last name");
            user.setLastname(lastname.trim());
        }

        if (!ValidationUtil.isNullOrEmpty(email)) {
            if (!ValidationUtil.isValidEmail(email)) {
                throw new ValidationException("Invalid email format");
            }

            var normalizedEmail = email.toLowerCase().trim();
            if (!normalizedEmail.equals(user.getEmail()) &&
                    userRepository.existsByEmail(normalizedEmail)) {
                throw new ValidationException("Email already in use");
            }
            user.setEmail(normalizedEmail);
        }

        if (!ValidationUtil.isNullOrEmpty(currentPassword) &&
                !ValidationUtil.isNullOrEmpty(newPassword)) {

            if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
                throw new ValidationException("Current password is incorrect");
            }

            ValidationUtil.validatePassword(newPassword);
            user.setPassword(passwordEncoder.encode(newPassword));
        }

        if (profilePicture != null && !profilePicture.isEmpty()) {
            validateProfilePictureUpload(profilePicture);
            replaceProfilePicture(user, profilePicture);
        }

        userRepository.save(user);

        return new UserDTO(
                user.getId(),
                user.getFirstname(),
                user.getLastname(),
                user.getEmail(),
                user.getProfilePicture()
        );
    }

    private User getUserById(Integer id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private void validateRegistrationRequest(UserRegistrationRequest request) {
        if (ValidationUtil.isNullOrEmpty(request.firstname()) ||
                ValidationUtil.isNullOrEmpty(request.lastname()) ||
                ValidationUtil.isNullOrEmpty(request.email()) ||
                ValidationUtil.isNullOrEmpty(request.password())) {
            throw new ValidationException("All fields are required");
        }

        if (!ValidationUtil.isValidEmail(request.email())) {
            throw new ValidationException("Invalid email format");
        }

        if (userRepository.existsByEmail(request.email().toLowerCase().trim())) {
            throw new ValidationException("Registration failed. Please check your details.");
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
        var profilePicturePath = fileStorageService.storeFile(profilePicture);
        user.setProfilePicture(profilePicturePath);
        if (oldPicture != null) {
            try {
                fileStorageService.deleteFile(oldPicture);
            } catch (Exception e) {
                // Old file cleanup is best-effort; new file is already set
            }
        }
    }

    private void validateImageMagicBytes(MultipartFile file) {
        try {
            var fileBytes = file.getBytes();
            if (!FileValidationConstants.isValidImageByMagicBytes(fileBytes)) {
                throw new ValidationException("File content doesn't match image type. Upload a valid image file.");
            }
        } catch (IOException e) {
            throw new ValidationException("Could not validate image file");
        }
    }
}
