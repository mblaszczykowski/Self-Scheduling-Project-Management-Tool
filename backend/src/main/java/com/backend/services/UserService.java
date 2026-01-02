package com.backend.services;

import com.backend.daos.UserDAO;
import com.backend.dtos.UserDTO;
import com.backend.entities.User;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.requests.UserRegistrationRequest;
import com.backend.util.ValidationUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@Service
public class UserService {

    private final UserDAO userDAO;
    private final TokenService tokenService;
    private final FileStorageService fileStorageService;
    private final BCryptPasswordEncoder passwordEncoder;

    @Autowired
    public UserService(UserDAO userDAO,
                       TokenService tokenService,
                       FileStorageService fileStorageService) {
        this.userDAO = userDAO;
        this.tokenService = tokenService;
        this.fileStorageService = fileStorageService;
        this.passwordEncoder = new BCryptPasswordEncoder(12);
    }

    public boolean existsUserByEmail(String email) {
        return userDAO.existsUserWithEmail(email);
    }

    public User findUserByEmail(String email) {
        return userDAO.getUserByEmail(email).orElse(null);
    }

    public User getUserByEmail(String email) {
        return userDAO.getUserByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    @Transactional
    public ResponseEntity<?> registerUser(UserRegistrationRequest request) {
        validateRegistrationRequest(request);
        ValidationUtil.validatePassword(request.password());
        ValidationUtil.validateName(request.firstname(), "First name");
        ValidationUtil.validateName(request.lastname(), "Last name");

        String hashedPassword = passwordEncoder.encode(request.password());

        User user = new User(
                request.firstname().trim(),
                request.lastname().trim(),
                request.email().toLowerCase().trim(),
                hashedPassword
        );

        userDAO.save(user);

        TokenService.AuthTokens tokens = tokenService.createAuthTokens(user.getId());

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, tokens.getAccessCookie().toString())
                .header(HttpHeaders.SET_COOKIE, tokens.getRefreshCookie().toString())
                .body(Map.of(
                        "message", "Registration successful",
                        "userId", user.getId(),
                        "email", user.getEmail()
                ));
    }

    public ResponseEntity<?> getUserDetails(Integer userId) {
        User user = getUserById(userId);
        UserDTO userDTO = new UserDTO(
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

        User user = userDAO.getUserById(userId)
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

            String normalizedEmail = email.toLowerCase().trim();
            if (!normalizedEmail.equals(user.getEmail()) &&
                    userDAO.existsUserWithEmail(normalizedEmail)) {
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
            String contentType = profilePicture.getContentType();
            if (contentType == null || !contentType.startsWith("image/")) {
                throw new ValidationException("Invalid file type. Only images are allowed");
            }

            if (user.getProfilePicture() != null) {
                fileStorageService.deleteFile(user.getProfilePicture());
            }

            String profilePicturePath = fileStorageService.storeFile(profilePicture);
            user.setProfilePicture(profilePicturePath);
        }

        userDAO.save(user);

        return new UserDTO(
                user.getId(),
                user.getFirstname(),
                user.getLastname(),
                user.getEmail(),
                user.getProfilePicture()
        );
    }

    private User getUserById(Integer id) {
        return userDAO.getUserById(id)
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

        if (userDAO.existsUserWithEmail(request.email().toLowerCase().trim())) {
            throw new ValidationException("Email already registered");
        }
    }
}