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
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class UserService {

    private final UserDAO userDAO;
    private final TokenService tokenService;
    private final FileStorageService fileStorageService;

    @Autowired
    public UserService(UserDAO userDAO, TokenService tokenService, FileStorageService fileStorageService) {
        this.userDAO = userDAO;
        this.tokenService = tokenService;
        this.fileStorageService = fileStorageService;
    }

    public boolean existsUserByEmail(String email) {
        return userDAO.existsUserWithEmail(email);
    }

    public ResponseEntity<?> registerUser(UserRegistrationRequest request) {
        validateRegistrationRequest(request);
        var hashedPassword = hashPassword(request.password());
        var user = new User(
                request.firstname(),
                request.lastname(),
                request.email(),
                hashedPassword
        );
        userDAO.addUser(user);
        var cookie = tokenService.createAuthCookie(String.valueOf(user.getId()));
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body("Registration successful");
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

    public UserDTO updateUser(Integer userId, String firstname, String lastname, String email, String currentPassword, String newPassword, MultipartFile profilePicture) {
        User user = userDAO.getUserById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        user.setFirstname(firstname);
        user.setLastname(lastname);
        user.setEmail(email);

        if (currentPassword != null && !currentPassword.isEmpty() && newPassword != null && !newPassword.isEmpty()) {
            if (!BCrypt.checkpw(currentPassword, user.getPassword())) {
                throw new ValidationException("Current password is incorrect");
            }
            user.setPassword(hashPassword(newPassword));
        }

        if (profilePicture != null && !profilePicture.isEmpty()) {
            if (user.getProfilePicture() != null) {
                fileStorageService.deleteFile(user.getProfilePicture());
            }
            String profilePicturePath = fileStorageService.storeFile(profilePicture);
            user.setProfilePicture(profilePicturePath);
        }

        userDAO.saveUser(user);

        return new UserDTO(
                user.getId(),
                user.getFirstname(),
                user.getLastname(),
                user.getEmail(),
                user.getProfilePicture()
        );
    }

    public User getUserByEmail(String email) {
        return userDAO.getUserByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User with email [" + email + "] not found"));
    }

    private User getUserById(Integer id) {
        return userDAO.getUserById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User with id [" + id + "] not found"));
    }

    private void validateRegistrationRequest(UserRegistrationRequest request) {
        if (ValidationUtil.isNullOrEmpty(request.firstname()) ||
                ValidationUtil.isNullOrEmpty(request.lastname()) ||
                ValidationUtil.isNullOrEmpty(request.email()) ||
                ValidationUtil.isNullOrEmpty(request.password())) {
            throw new ValidationException("Missing required fields");
        }
        if (!ValidationUtil.isValidEmail(request.email())) {
            throw new ValidationException("Invalid email format");
        }
        if (userDAO.existsUserWithEmail(request.email())) {
            throw new ValidationException("Email already exists");
        }
        ValidationUtil.validatePassword(request.password());
    }

    private String hashPassword(String password) {
        return BCrypt.hashpw(password, BCrypt.gensalt(12));
    }
}
