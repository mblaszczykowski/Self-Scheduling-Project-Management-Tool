package com.backend.controllers;

import com.backend.dtos.UserDTO;
import com.backend.requests.EmailPreferencesRequest;
import com.backend.requests.UserRegistrationRequest;
import com.backend.services.TokenService;
import com.backend.services.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final TokenService tokenService;

    @Autowired
    public UserController(UserService userService, TokenService tokenService) {
        this.userService = userService;
        this.tokenService = tokenService;
    }

    @GetMapping
    public ResponseEntity<UserDTO> getCurrentUser(HttpServletRequest request) {
        int userId = tokenService.getUserIdFromRequest(request);
        return ResponseEntity.ok(userService.getUserDetails(userId));
    }

    @GetMapping("/{email}")
    public ResponseEntity<UserDTO> getUserByEmail(
            HttpServletRequest request,
            @PathVariable("email") String email
    ) {
        Integer requestingUserId = tokenService.getUserIdFromRequest(request);
        return ResponseEntity.ok(userService.getUserByEmailForRequester(email, requestingUserId));
    }

    @PostMapping
    public ResponseEntity<?> registerUser(@Valid @RequestBody UserRegistrationRequest request) {
        var result = userService.registerUser(request);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, result.tokens().accessCookie().toString())
                .header(HttpHeaders.SET_COOKIE, result.tokens().refreshCookie().toString())
                .body(Map.of(
                        "message", "Registration successful",
                        "userId", result.userId(),
                        "email", result.email()
                ));
    }

    @GetMapping("/exists")
    public ResponseEntity<?> checkUserExists(@RequestParam String email) {
        boolean exists = userService.existsUserByEmail(email);
        return ResponseEntity.ok().body(Map.of("exists", exists));
    }

    @PatchMapping("/email-preferences")
    public ResponseEntity<UserDTO> updateEmailPreferences(
            HttpServletRequest request,
            @RequestBody EmailPreferencesRequest preferencesRequest
    ) {
        Integer userId = tokenService.getUserIdFromRequest(request);
        UserDTO updatedUser = userService.updateEmailPreferences(userId, preferencesRequest);
        return ResponseEntity.ok(updatedUser);
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