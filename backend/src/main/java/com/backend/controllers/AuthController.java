package com.backend.controllers;

import com.backend.dtos.LoginResponse;
import com.backend.dtos.MessageResponse;
import com.backend.requests.LoginRequest;
import com.backend.services.AuthService;
import com.backend.services.TokenService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest loginRequest,
                                               HttpServletRequest request) {
        var result = authService.authenticateUser(loginRequest, request);
        return withAuthCookies(result.tokens()).body(result.body());
    }

    @PostMapping("/refresh")
    public ResponseEntity<MessageResponse> refresh(HttpServletRequest request) {
        var tokens = authService.refreshAccessToken(request);
        return withAuthCookies(tokens).body(new MessageResponse("Token refreshed"));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        authService.logoutUser(request, response);
        return ResponseEntity.noContent().build();
    }

    private static ResponseEntity.BodyBuilder withAuthCookies(TokenService.AuthTokens tokens) {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, tokens.accessCookie().toString())
                .header(HttpHeaders.SET_COOKIE, tokens.refreshCookie().toString());
    }
}
