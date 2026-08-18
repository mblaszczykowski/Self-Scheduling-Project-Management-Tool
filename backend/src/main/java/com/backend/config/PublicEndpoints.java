package com.backend.config;

import java.util.Set;

/**
 * The deny-by-default authentication and CSRF policy, in one place.
 *
 * <p>Matching is exact on the raw request URI, which is fail-closed: a matrix-parameter or
 * encoding trick makes a path <em>less</em> likely to match an exemption, never more.
 */
public final class PublicEndpoints {

    private PublicEndpoints() {
    }

    public static final String LOGIN = "/api/auth/login";
    public static final String REFRESH = "/api/auth/refresh";
    public static final String USERS = "/api/users";
    public static final String ERROR = "/error";
    public static final String ACTUATOR_HEALTH = "/actuator/health";

    /**
     * Endpoints reachable without an access token.
     *
     * <p>{@code /api/users} is exempt for POST only (registration) — see
     * {@link #isPublicForJwt}. {@code /api/auth/refresh} must be reachable precisely because
     * the access token has expired.
     */
    private static final Set<String> JWT_EXEMPT_ENDPOINTS = Set.of(LOGIN, REFRESH, USERS);

    /**
     * Endpoints exempt from the double-submit CSRF check.
     *
     * <p>Only the two that cannot have a CSRF cookie yet: login and registration are the
     * requests that establish a session. {@code /api/auth/refresh} is deliberately <em>not</em>
     * here — the client already sends the header on it, and exempting it would leave a hole
     * open if {@code app.cookie.same-site} were ever relaxed to {@code None}.
     */
    private static final Set<String> CSRF_EXEMPT_ENDPOINTS = Set.of(LOGIN);

    public static boolean isPublicForJwt(String path, String method) {
        if (JWT_EXEMPT_ENDPOINTS.contains(path)) {
            // Registration is public; reading or updating the current user is not.
            return !USERS.equals(path) || "POST".equalsIgnoreCase(method);
        }
        return ERROR.equals(path) || ACTUATOR_HEALTH.equals(path);
    }

    public static boolean isCsrfExempt(String path, String method) {
        if (USERS.equals(path) && "POST".equalsIgnoreCase(method)) {
            return true;
        }
        return CSRF_EXEMPT_ENDPOINTS.contains(path) || ERROR.equals(path)
                || ACTUATOR_HEALTH.equals(path);
    }
}
