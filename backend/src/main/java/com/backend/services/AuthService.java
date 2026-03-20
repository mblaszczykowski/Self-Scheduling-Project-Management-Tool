package com.backend.services;

import com.backend.config.CookieProperties;
import com.backend.entities.User;
import com.backend.exception.AuthorizationException;
import com.backend.exception.ValidationException;
import com.backend.filter.RateLimitFilter;
import com.backend.requests.LoginRequest;
import com.backend.util.ValidationUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Set;

@Service
public class AuthService {

    private final UserService userService;
    private final TokenService tokenService;
    private final RateLimitFilter rateLimitFilter;
    private final BCryptPasswordEncoder passwordEncoder;
    private final CookieProperties cookieProperties;
    private final Set<String> trustedProxies;

    @Autowired
    public AuthService(UserService userService,
                       TokenService tokenService,
                       RateLimitFilter rateLimitFilter,
                       BCryptPasswordEncoder passwordEncoder,
                       CookieProperties cookieProperties,
                       @Value("${app.trusted-proxies:}") String trustedProxiesConfig) {
        this.userService = userService;
        this.tokenService = tokenService;
        this.rateLimitFilter = rateLimitFilter;
        this.passwordEncoder = passwordEncoder;
        this.cookieProperties = cookieProperties;
        this.trustedProxies = com.backend.util.IpUtil.parseTrustedProxies(trustedProxiesConfig);
    }

    private static final String TIMING_ATTACK_PREVENTION_HASH = "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYIWWwK6W6Wy";

    public record LoginResult(Map<String, Object> body, TokenService.AuthTokens tokens) {}

    @Transactional(rollbackFor = Exception.class)
    public LoginResult authenticateUser(LoginRequest loginRequest, HttpServletRequest httpRequest) {
        validateLoginRequest(loginRequest);

        var user = userService.findUserByEmailOrNull(loginRequest.email());
        var credentialsValid = verifyCredentialsWithConstantTime(user, loginRequest.password());

        if (!credentialsValid) {
            throw new ValidationException("Invalid email or password");
        }

        rateLimitFilter.resetLoginAttempts(getClientIp(httpRequest));

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
        return com.backend.util.IpUtil.getClientIp(request, trustedProxies);
    }

    @Transactional(rollbackFor = Exception.class)
    public TokenService.AuthTokens refreshAccessToken(HttpServletRequest request) {
        String refreshToken = null;
        if (request.getCookies() != null) {
            for (var cookie : request.getCookies()) {
                if ("refreshToken".equals(cookie.getName())) {
                    refreshToken = cookie.getValue();
                    break;
                }
            }
        }

        if (refreshToken == null) {
            throw new AuthorizationException("Refresh token not provided");
        }

        var userId = tokenService.validateRefreshToken(refreshToken);
        if (userId == null) {
            throw new AuthorizationException("Invalid or expired refresh token");
        }

        return tokenService.createAuthTokens(userId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void logoutUser(HttpServletRequest request, HttpServletResponse response) {
        var userId = (Integer) request.getAttribute("userId");

        if (userId != null) {
            tokenService.revokeRefreshToken(userId);
        }

        var deleteAccessCookie = ResponseCookie.from("accessToken", "")
                .httpOnly(true)
                .secure(cookieProperties.isSecure())
                .path("/")
                .maxAge(0)
                .sameSite(cookieProperties.getSameSite())
                .build();

        var deleteRefreshCookie = ResponseCookie.from("refreshToken", "")
                .httpOnly(true)
                .secure(cookieProperties.isSecure())
                .path("/")
                .maxAge(0)
                .sameSite(cookieProperties.getSameSite())
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

    private boolean verifyCredentialsWithConstantTime(User user, String password) {
        var hashToCompare = (user != null) ? user.getPassword() : TIMING_ATTACK_PREVENTION_HASH;
        var passwordMatches = passwordEncoder.matches(password, hashToCompare);
        return user != null && passwordMatches;
    }
}