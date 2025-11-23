package com.backend.services;

import com.backend.exception.ApiError;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.requests.LoginRequest;
import com.backend.util.ValidationUtil;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    private final UserService userService;
    private final TokenService tokenService;

    public AuthService(UserService userService,
                       TokenService tokenService) {
        this.userService = userService;
        this.tokenService = tokenService;
    }

    public void logoutUser(HttpServletResponse response) {
        ResponseCookie deleteCookie = ResponseCookie.from("accessToken", "")
                .httpOnly(true)
                .secure(false)
                .path("/")
                .maxAge(0)
                .sameSite("Lax")
                .build();
        response.setHeader(HttpHeaders.SET_COOKIE, deleteCookie.toString());
    }

    public ResponseEntity<?> authenticateUser(LoginRequest request) {
        validateLoginRequest(request);
        try {
            var user = userService.getUserByEmail(request.email());
            if (BCrypt.checkpw(request.password(), user.getPassword())) {
                var cookie = tokenService.createAuthCookie(String.valueOf(user.getId()));
                return ResponseEntity.ok()
                        .header(HttpHeaders.SET_COOKIE, cookie.toString())
                        .body("Login successful");
            } else {
                ApiError error = new ApiError("Validation", "Password", "Invalid password");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
            }
        } catch (ResourceNotFoundException ex) {
            ApiError error = new ApiError("Validation", "E-mail", "Invalid e-mail");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
        }
    }

    public void validateLoginRequest(LoginRequest request) {
        if (ValidationUtil.isNullOrEmpty(request.email()) || ValidationUtil.isNullOrEmpty(request.password())) {
            throw new ValidationException("Email and password are required");
        }
    }
}
