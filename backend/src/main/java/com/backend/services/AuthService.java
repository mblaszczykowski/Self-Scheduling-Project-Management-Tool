package com.backend.services;

import com.backend.dtos.LoginResponse;
import com.backend.entities.User;
import com.backend.exception.UnauthenticatedException;
import com.backend.exception.TooManyAttemptsException;
import com.backend.exception.ValidationException;
import com.backend.requests.LoginRequest;
import com.backend.services.RateLimitService.Bucket;
import com.backend.util.ValidationUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private static final String TIMING_ATTACK_PREVENTION_HASH =
            "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYIWWwK6W6Wy";

    private final UserService userService;
    private final TokenService tokenService;
    private final RateLimitService rateLimitService;
    private final BCryptPasswordEncoder passwordEncoder;

    public AuthService(UserService userService,
                       TokenService tokenService,
                       RateLimitService rateLimitService,
                       BCryptPasswordEncoder passwordEncoder) {
        this.userService = userService;
        this.tokenService = tokenService;
        this.rateLimitService = rateLimitService;
        this.passwordEncoder = passwordEncoder;
    }

    public record LoginResult(LoginResponse body, TokenService.AuthTokens tokens) {}

    public LoginResult authenticateUser(LoginRequest loginRequest, HttpServletRequest httpRequest) {
        validateLoginRequest(loginRequest);

        var clientIp = httpRequest.getRemoteAddr();
        var attemptKey = RateLimitService.loginKey(clientIp, loginRequest.email());
        if (!rateLimitService.allow(Bucket.LOGIN, attemptKey)) {
            log.warn("Login throttled: client={} emailHash={}", clientIp, emailHash(loginRequest.email()));
            throw new TooManyAttemptsException("Too many login attempts. Please try again later.");
        }

        var user = userService.findUserByEmailOrNull(loginRequest.email());
        if (!verifyCredentialsWithConstantTime(user, loginRequest.password())) {
            log.warn("Failed login: client={} emailHash={}", clientIp, emailHash(loginRequest.email()));
            throw new ValidationException("Invalid email or password");
        }

        rateLimitService.reset(Bucket.LOGIN, attemptKey);
        log.info("Login succeeded: userId={} client={}", user.getId(), clientIp);

        return new LoginResult(
                new LoginResponse("Login successful", user.getId(), user.getEmail(), user.getFullName()),
                tokenService.createAuthTokens(user.getId()));
    }

    public TokenService.AuthTokens refreshAccessToken(HttpServletRequest request) {
        var presented = TokenService.readRefreshCookie(request)
                .orElseThrow(() -> new UnauthenticatedException("Refresh token not provided"));

        var rotation = tokenService.rotateRefreshToken(presented);
        if (!rotation.succeeded()) {
            throw new UnauthenticatedException(rotation.failureMessage());
        }
        return tokenService.buildCookies(rotation.userId(), rotation.refreshToken());
    }

    public void logoutUser(HttpServletRequest request, HttpServletResponse response) {
        TokenService.readRefreshCookie(request).ifPresent(tokenService::revokeRefreshToken);
        response.addHeader(HttpHeaders.SET_COOKIE, tokenService.accessCookieDeletion().toString());
        response.addHeader(HttpHeaders.SET_COOKIE, tokenService.refreshCookieDeletion().toString());
    }

    private void validateLoginRequest(LoginRequest request) {
        if (ValidationUtil.isNullOrEmpty(request.email())
                || ValidationUtil.isNullOrEmpty(request.password())) {
            throw new ValidationException("Email and password are required");
        }
        if (!ValidationUtil.isValidEmail(request.email())) {
            throw new ValidationException("Invalid email format");
        }
    }

    private boolean verifyCredentialsWithConstantTime(User user, String password) {
        var hashToCompare = (user != null) ? user.getPassword() : TIMING_ATTACK_PREVENTION_HASH;
        var passwordMatches = passwordEncoder.matches(password, hashToCompare);
        return user != null && passwordMatches;
    }

    private static String emailHash(String email) {
        if (email == null) {
            return "none";
        }
        return Integer.toHexString(email.toLowerCase().trim().hashCode());
    }
}
