package com.backend.controllers;

import com.backend.dtos.UserDTO;
import com.backend.entities.User;
import com.backend.requests.UserRegistrationRequest;
import com.backend.services.TokenService;
import com.backend.services.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("api/users")
public class UserController {

    private final UserService userService;
    private final TokenService tokenService;

    @Autowired
    public UserController(UserService userService, TokenService tokenService) {
        this.userService = userService;
        this.tokenService = tokenService;
    }

    @GetMapping
    public ResponseEntity<?> getCurrentUser(HttpServletRequest request) {
        int userId = tokenService.getUserIdFromRequest(request);
        return userService.getUserDetails(userId);
    }

    @GetMapping("/{email}")
    public ResponseEntity<UserDTO> getUserByEmail(
            HttpServletRequest request,
            @PathVariable("email") String email
    ) {
        // Verify user is authenticated
        tokenService.getUserIdFromRequest(request);

        // Return DTO instead of entity to avoid exposing password hash
        User user = userService.getUserByEmail(email);
        UserDTO userDTO = new UserDTO(
                user.getId(),
                user.getFirstname(),
                user.getLastname(),
                user.getEmail(),
                user.getProfilePicture()
        );
        return ResponseEntity.ok(userDTO);
    }

    @PostMapping
    public ResponseEntity<?> registerUser(@RequestBody UserRegistrationRequest request) {
        return userService.registerUser(request);
    }

    @GetMapping("/exists")
    public ResponseEntity<?> checkUserExists(@RequestParam String email) {
        boolean exists = userService.existsUserByEmail(email);
        return ResponseEntity.ok().body(Map.of("exists", exists));
    }

    @PutMapping(consumes = {"multipart/form-data"})
    public ResponseEntity<UserDTO> updateUser(
            HttpServletRequest request,
            @RequestParam("firstname") String firstname,
            @RequestParam("lastname") String lastname,
            @RequestParam("email") String email,
            @RequestParam(value = "currentPassword", required = false) String currentPassword,
            @RequestParam(value = "newPassword", required = false) String newPassword,
            @RequestPart(value = "profilePicture", required = false) MultipartFile profilePicture
    ) {
        Integer userId = tokenService.getUserIdFromRequest(request);
        UserDTO updatedUser = userService.updateUser(userId, firstname, lastname, email,
                currentPassword, newPassword, profilePicture);
        return ResponseEntity.ok(updatedUser);
    }
}