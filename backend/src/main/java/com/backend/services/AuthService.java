package com.backend.services;

import com.backend.entities.User;
import com.backend.exception.ValidationException;
import com.backend.requests.LoginRequest;
import com.backend.util.ValidationUtil;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

@Service
public class AuthService {

    private final UserService userService;
    private final TokenService tokenService;
    private final BCryptPasswordEncoder passwordEncoder;
    private final boolean secureCookie;
    private final String sameSite;

    @Autowired
    public AuthService(UserService userService,
                       TokenService tokenService,
                       @Value("${app.cookie.secure:true}") boolean secureCookie,
                       @Value("${app.cookie.same-site:Strict}") String sameSite) {
        this.userService = userService;
        this.tokenService = tokenService;
        this.passwordEncoder = new BCryptPasswordEncoder(12);
        this.secureCookie = secureCookie;
        this.sameSite = sameSite;
    }

    @Transactional
    public ResponseEntity<?> authenticateUser(LoginRequest request) {
        validateLoginRequest(request);

        String genericError = "Invalid email or password";

        User user = userService.findUserByEmail(request.email());
        if (user == null) {
            return ResponseEntity.badRequest().body(Map.of("error", genericError));
        }

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            return ResponseEntity.badRequest().body(Map.of("error", genericError));
        }

        TokenService.AuthTokens tokens = tokenService.createAuthTokens(user.getId());

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Login successful");
        response.put("userId", user.getId());
        response.put("email", user.getEmail());
        response.put("name", user.getFullName());

        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.SET_COOKIE, tokens.getAccessCookie().toString());
        headers.add(HttpHeaders.SET_COOKIE, tokens.getRefreshCookie().toString());

        return ResponseEntity.ok().headers(headers).body(response);
    }

    @Transactional
    public ResponseEntity<?> refreshAccessToken(HttpServletRequest request) {
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
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Refresh token not provided"));
        }

        Integer userId = tokenService.validateRefreshToken(refreshToken);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid or expired refresh token"));
        }

        // Rotate tokens - issue new access AND refresh tokens
        TokenService.AuthTokens tokens = tokenService.createAuthTokens(userId);

        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.SET_COOKIE, tokens.getAccessCookie().toString());
        headers.add(HttpHeaders.SET_COOKIE, tokens.getRefreshCookie().toString());

        return ResponseEntity.ok().headers(headers).body(Map.of("message", "Token refreshed successfully"));
    }

    @Transactional
    public void logoutUser(HttpServletRequest request, HttpServletResponse response) {
        Integer userId = (Integer) request.getAttribute("userId");

        if (userId != null) {
            tokenService.revokeRefreshToken(userId);
        }

        ResponseCookie deleteAccessCookie = ResponseCookie.from("accessToken", "")
                .httpOnly(true)
                .secure(secureCookie)
                .path("/")
                .maxAge(0)
                .sameSite(sameSite)
                .build();

        ResponseCookie deleteRefreshCookie = ResponseCookie.from("refreshToken", "")
                .httpOnly(true)
                .secure(secureCookie)
                .path("/")
                .maxAge(0)
                .sameSite(sameSite)
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
}