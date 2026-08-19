package com.backend.controllers;

import com.backend.dtos.CurrentUserDTO;
import com.backend.dtos.LoginResponse;
import com.backend.dtos.UserDTO;
import com.backend.requests.EmailPreferencesRequest;
import com.backend.requests.UpdateProfileRequest;
import com.backend.requests.UserRegistrationRequest;
import com.backend.services.UserService;
import com.backend.web.CurrentUserId;
import com.backend.web.RequestValidator;
import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserService userService;
    private final RequestValidator requestValidator;

    public UserController(UserService userService, RequestValidator requestValidator) {
        this.userService = userService;
        this.requestValidator = requestValidator;
    }

    @PostMapping
    public ResponseEntity<LoginResponse> register(@Valid @RequestBody UserRegistrationRequest request) {
        var result = userService.registerUser(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.SET_COOKIE, result.tokens().accessCookie().toString())
                .header(HttpHeaders.SET_COOKIE, result.tokens().refreshCookie().toString())
                .body(new LoginResponse("Registration successful", result.userId(), result.email(), null));
    }

    @GetMapping("/me")
    public ResponseEntity<CurrentUserDTO> getCurrentUser(@CurrentUserId Integer userId) {
        return ResponseEntity.ok(userService.getCurrentUser(userId));
    }

    @PutMapping(value = "/me", consumes = {"multipart/form-data"})
    public ResponseEntity<CurrentUserDTO> updateProfile(
            @CurrentUserId Integer userId,
            @RequestPart("profile") String profileJson,
            @RequestPart(value = "profilePicture", required = false) MultipartFile profilePicture
    ) throws JsonProcessingException {
        var request = requestValidator.parseAndValidate(profileJson, UpdateProfileRequest.class);
        return ResponseEntity.ok(userService.updateProfile(userId, request, profilePicture));
    }

    @PatchMapping("/me/email-preferences")
    public ResponseEntity<CurrentUserDTO> updateEmailPreferences(
            @CurrentUserId Integer userId,
            @Valid @RequestBody EmailPreferencesRequest request
    ) {
        return ResponseEntity.ok(userService.updateEmailPreferences(userId, request));
    }

    @GetMapping("/lookup")
    public ResponseEntity<UserDTO> lookupByEmail(@CurrentUserId Integer userId,
                                                 @RequestParam String email) {
        return ResponseEntity.ok(userService.getUserByEmailForRequester(email, userId));
    }
}
