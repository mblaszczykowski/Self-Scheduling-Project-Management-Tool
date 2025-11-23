package com.backend.services;

import com.backend.entities.User;
import com.backend.exception.TooManyAttemptsException;
import com.backend.exception.ValidationException;
import com.backend.requests.LoginRequest;
import com.backend.util.ValidationUtil;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Service
public class AuthService {

    private final UserService userService;
    private final TokenService tokenService;
    private final BCryptPasswordEncoder passwordEncoder;

    // Rate limiting: track failed login attempts
    private final Map<String, LoginAttemptInfo> loginAttempts = new ConcurrentHashMap<>();
    private static final int MAX_ATTEMPTS = 5;
    private static final long LOCKOUT_DURATION = TimeUnit.MINUTES.toMillis(15);

    @Autowired
    public AuthService(UserService userService, TokenService tokenService) {
        this.userService = userService;
        this.tokenService = tokenService;
        this.passwordEncoder = new BCryptPasswordEncoder(12);
    }

    @Transactional
    public ResponseEntity<?> authenticateUser(LoginRequest request) {
        validateLoginRequest(request);

        // Check rate limiting
        checkLoginAttempts(request.email());

        try {
            // Generic error message to avoid information disclosure
            String genericError = "Invalid email or password";

            // Check if user exists
            User user = userService.findUserByEmail(request.email());
            if (user == null) {
                recordFailedAttempt(request.email());
                return ResponseEntity.badRequest().body(Map.of("error", genericError));
            }

            // Verify password
            if (!passwordEncoder.matches(request.password(), user.getPassword())) {
                recordFailedAttempt(request.email());
                return ResponseEntity.badRequest().body(Map.of("error", genericError));
            }

            // Clear failed attempts on successful login
            clearFailedAttempts(request.email());

            // Generate tokens
            TokenService.AuthTokens tokens = tokenService.createAuthTokens(user.getId());

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Login successful");
            response.put("userId", user.getId());
            response.put("email", user.getEmail());
            response.put("name", user.getFullName());

            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, tokens.getAccessCookie().toString())
                    .header(HttpHeaders.SET_COOKIE, tokens.getRefreshCookie().toString())
                    .body(response);

        } catch (Exception e) {
            recordFailedAttempt(request.email());
            return ResponseEntity.badRequest().body(Map.of("error", "Authentication failed"));
        }
    }

    @Transactional
    public ResponseEntity<?> refreshAccessToken(HttpServletRequest request) {
        // Extract refresh token from cookie
        String refreshToken = null;
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("refreshToken".equals(cookie.getName())) {
                    refreshToken = cookie.getValue();
                    break;
                }
            }
        }

        if (refreshToken == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Refresh token not provided"));
        }

        // Validate refresh token
        Integer userId = tokenService.validateRefreshToken(refreshToken);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid or expired refresh token"));        }

        // Generate new access token
        String newAccessToken = tokenService.generateAccessToken(userId);

        ResponseCookie accessCookie = ResponseCookie.from("accessToken", newAccessToken)
                .httpOnly(true)
                .secure(false) // Set to true in production
                .path("/")
                .maxAge(tokenService.getAccessTokenExpiration())
                .sameSite("Lax")
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, accessCookie.toString())
                .body(Map.of("message", "Token refreshed successfully"));
    }

    @Transactional
    public void logoutUser(HttpServletRequest request, HttpServletResponse response) {
        // Get user ID from request (set by JWT filter)
        Integer userId = (Integer) request.getAttribute("userId");

        if (userId != null) {
            // Revoke refresh token
            tokenService.revokeRefreshToken(userId);
        }

        // Clear cookies
        ResponseCookie deleteAccessCookie = ResponseCookie.from("accessToken", "")
                .httpOnly(true)
                .secure(false)
                .path("/")
                .maxAge(0)
                .sameSite("Lax")
                .build();

        ResponseCookie deleteRefreshCookie = ResponseCookie.from("refreshToken", "")
                .httpOnly(true)
                .secure(false)
                .path("/api/auth/refresh")
                .maxAge(0)
                .sameSite("Lax")
                .build();

        response.setHeader(HttpHeaders.SET_COOKIE, deleteAccessCookie.toString());
        response.addHeader(HttpHeaders.SET_COOKIE, deleteRefreshCookie.toString());
    }

    private void validateLoginRequest(LoginRequest request) {
        if (ValidationUtil.isNullOrEmpty(request.email()) ||
                ValidationUtil.isNullOrEmpty(request.password())) {
            throw new ValidationException("Email and password are required");
        }

        if (!ValidationUtil.isValidEmail(request.email())) {
            throw new ValidationException("Invalid email format");
        }
    }

    private void checkLoginAttempts(String email) {
        LoginAttemptInfo attemptInfo = loginAttempts.get(email);
        if (attemptInfo != null) {
            long timeSinceLastAttempt = System.currentTimeMillis() - attemptInfo.lastAttemptTime;

            // Check if account is locked
            if (attemptInfo.attempts >= MAX_ATTEMPTS) {
                if (timeSinceLastAttempt < LOCKOUT_DURATION) {
                    long remainingTime = (LOCKOUT_DURATION - timeSinceLastAttempt) / 1000 / 60;
                    throw new TooManyAttemptsException(
                            "Account locked due to too many failed attempts. Try again in " +
                                    remainingTime + " minutes."
                    );
                } else {
                    // Lockout period expired, reset attempts
                    loginAttempts.remove(email);
                }
            }
        }
    }

    private void recordFailedAttempt(String email) {
        loginAttempts.compute(email, (key, value) -> {
            if (value == null) {
                return new LoginAttemptInfo(1, System.currentTimeMillis());
            } else {
                return new LoginAttemptInfo(value.attempts + 1, System.currentTimeMillis());
            }
        });
    }

    private void clearFailedAttempts(String email) {
        loginAttempts.remove(email);
    }

    // Clean up old attempts periodically (can be scheduled)
    public void cleanupOldAttempts() {
        long now = System.currentTimeMillis();
        loginAttempts.entrySet().removeIf(entry ->
                now - entry.getValue().lastAttemptTime > LOCKOUT_DURATION
        );
    }

    private static class LoginAttemptInfo {
        final int attempts;
        final long lastAttemptTime;

        LoginAttemptInfo(int attempts, long lastAttemptTime) {
            this.attempts = attempts;
            this.lastAttemptTime = lastAttemptTime;
        }
    }
}