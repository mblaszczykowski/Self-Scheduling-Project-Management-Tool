package com.backend.config;

import java.util.Set;

/**
 * Centralized configuration for public endpoints that don't require authentication.
 * Used by JwtAuthenticationFilter, CsrfProtectionFilter, and RateLimitFilter.
 */
public final class PublicEndpoints {

    private PublicEndpoints() {
        // Utility class - prevent instantiation
    }

    // Authentication endpoints (no JWT required)
    public static final String LOGIN = "/api/auth/login";
    public static final String REFRESH = "/api/auth/refresh";
    public static final String LOGOUT = "/api/auth/logout";

    // User registration endpoint (POST only is public)
    public static final String USERS = "/api/users";
    public static final String USER_EXISTS = "/api/users/exists";

    // Static content prefixes
    public static final String FILES_PREFIX = "/files/";
    public static final String UPLOADS_PREFIX = "/uploads/";
    public static final String STATIC_PREFIX = "/static/";

    // Error endpoint
    public static final String ERROR = "/error";

    /**
     * Endpoints that don't require JWT authentication.
     * Note: /api/users requires POST method check separately.
     */
    public static final Set<String> JWT_EXEMPT_ENDPOINTS = Set.of(
            LOGIN,
            REFRESH,
            USERS,
            USER_EXISTS
    );

    /**
     * Endpoints exempt from CSRF protection.
     * These are either stateless or public registration endpoints.
     */
    public static final Set<String> CSRF_EXEMPT_ENDPOINTS = Set.of(
            LOGIN,
            REFRESH,
            USER_EXISTS
    );

    /**
     * Rate-limited endpoints with their paths.
     */
    public static final String RATE_LIMIT_LOGIN = LOGIN;
    public static final String RATE_LIMIT_REGISTER = USERS;

    /**
     * Check if the path is a static content path that doesn't require authentication.
     */
    public static boolean isStaticContentPath(String path) {
        return path.startsWith(FILES_PREFIX) ||
                path.startsWith(UPLOADS_PREFIX) ||
                path.startsWith(STATIC_PREFIX) ||
                path.equals(ERROR);
    }

    /**
     * Check if the endpoint is public for JWT authentication purposes.
     * Considers both the path and HTTP method.
     */
    public static boolean isPublicForJwt(String path, String method) {
        if (JWT_EXEMPT_ENDPOINTS.contains(path)) {
            // /api/users is only public for POST (registration)
            if (USERS.equals(path)) {
                return "POST".equalsIgnoreCase(method);
            }
            return true;
        }
        return isStaticContentPath(path);
    }

    /**
     * Check if the endpoint is exempt from CSRF protection.
     * Considers both the path and HTTP method.
     */
    public static boolean isCsrfExempt(String path, String method) {
        // Registration is POST but needs to be exempt (no existing session)
        if (USERS.equals(path) && "POST".equalsIgnoreCase(method)) {
            return true;
        }
        return CSRF_EXEMPT_ENDPOINTS.contains(path) || isStaticContentPath(path);
    }
}
