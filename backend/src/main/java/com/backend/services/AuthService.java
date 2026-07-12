package com.backend.services;

import com.backend.entities.User;
import com.backend.exception.AuthorizationException;
import com.backend.exception.ValidationException;
import com.backend.requests.LoginRequest;
import com.backend.util.CookieFactory;
import com.backend.util.IpUtil;
import com.backend.util.ValidationUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Set;

@Service
public class AuthService {

    private final UserService userService;
    private final TokenService tokenService;
    private final RateLimitService rateLimitService;
    private final BCryptPasswordEncoder passwordEncoder;
    private final CookieFactory cookieFactory;
    private final Set<String> trustedProxies;

    @Autowired
    public AuthService(UserService userService,
                       TokenService tokenService,
                       RateLimitService rateLimitService,
                       BCryptPasswordEncoder passwordEncoder,
                       CookieFactory cookieFactory,
                       @Value("${app.trusted-proxies:}") String trustedProxiesConfig) {
        this.userService = userService;
        this.tokenService = tokenService;
        this.rateLimitService = rateLimitService;
        this.passwordEncoder = passwordEncoder;
        this.cookieFactory = cookieFactory;
        this.trustedProxies = IpUtil.parseTrustedProxies(trustedProxiesConfig);
    }

    private static final String TIMING_ATTACK_PREVENTION_HASH = "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYIWWwK6W6Wy";

    public record LoginResult(Map<String, Object> body, TokenService.AuthTokens tokens) {}

    // Intentionally NOT @Transactional: the CPU-bound BCrypt verification must not pin a DB
    // connection. The only write (issuing the refresh token) opens its own transaction in
    // TokenService. The user lookup and credential check are read-only.
    public LoginResult authenticateUser(LoginRequest loginRequest, HttpServletRequest httpRequest) {
        validateLoginRequest(loginRequest);

        var user = userService.findUserByEmailOrNull(loginRequest.email());
        var credentialsValid = verifyCredentialsWithConstantTime(user, loginRequest.password());

        if (!credentialsValid) {
            throw new ValidationException("Invalid email or password");
        }

        rateLimitService.resetLoginAttempts(getClientIp(httpRequest));

        var tokens = tokenService.createAuthTokens(user.getId());

        var body = Map.<String, Object>of(
                "message", "Login successful",
                "userId", user.getId(),
                "email", user.getEmail(),
                "name", user.getFullName()
        );

        return new LoginResult(body, tokens);
    }

    private String getClientIp(HttpServletRequest request) {
        return IpUtil.getClientIp(request, trustedProxies);
    }

    @Transactional(rollbackFor = Exception.class)
    public TokenService.AuthTokens refreshAccessToken(HttpServletRequest request) {
        var refreshToken = CookieFactory.read(request, "refreshToken")
                .orElseThrow(() -> new AuthorizationException("Refresh token not provided"));

        var userId = tokenService.validateRefreshToken(refreshToken);
        if (userId == null) {
            throw new AuthorizationException("Invalid or expired refresh token");
        }

        // Rotate: invalidate the presented token and issue a fresh pair for this device only.
        tokenService.deleteRefreshToken(refreshToken);
        return tokenService.createAuthTokens(userId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void logoutUser(HttpServletRequest request, HttpServletResponse response) {
        // Log out only this device: revoke the presented refresh token, not all of the user's.
        CookieFactory.read(request, "refreshToken").ifPresent(tokenService::deleteRefreshToken);

        response.setHeader(HttpHeaders.SET_COOKIE, cookieFactory.deletion("accessToken", true).toString());
        response.addHeader(HttpHeaders.SET_COOKIE, cookieFactory.deletion("refreshToken", true).toString());
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

    private boolean verifyCredentialsWithConstantTime(User user, String password) {
        var hashToCompare = (user != null) ? user.getPassword() : TIMING_ATTACK_PREVENTION_HASH;
        var passwordMatches = passwordEncoder.matches(password, hashToCompare);
        return user != null && passwordMatches;
    }
}