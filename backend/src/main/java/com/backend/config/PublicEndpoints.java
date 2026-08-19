package com.backend.config;

import java.util.Set;

public final class PublicEndpoints {
    private PublicEndpoints() {
    }

    public static final String LOGIN = "/api/auth/login";
    public static final String REFRESH = "/api/auth/refresh";
    public static final String LOGOUT = "/api/auth/logout";
    public static final String USERS = "/api/users";
    public static final String ERROR = "/error";
    public static final String ACTUATOR_HEALTH = "/actuator/health";
    private static final String SWAGGER_UI_PREFIX = "/swagger-ui/";
    private static final String API_DOCS_PREFIX = "/v3/api-docs";

    private static final Set<String> JWT_EXEMPT_ENDPOINTS = Set.of(LOGIN, REFRESH, LOGOUT, USERS);

    private static final Set<String> CSRF_EXEMPT_ENDPOINTS = Set.of(LOGIN);

    public static boolean isPublicForJwt(String path, String method) {
        if (JWT_EXEMPT_ENDPOINTS.contains(path)) {
            return !USERS.equals(path) || "POST".equalsIgnoreCase(method);
        }
        return ERROR.equals(path) || ACTUATOR_HEALTH.equals(path) || isApiDocsPath(path);
    }

    private static boolean isApiDocsPath(String path) {
        return path.startsWith(SWAGGER_UI_PREFIX) || path.equals("/swagger-ui.html")
                || path.equals(API_DOCS_PREFIX) || path.startsWith(API_DOCS_PREFIX + "/")
                || path.equals(API_DOCS_PREFIX + ".yaml");
    }

    public static boolean isCsrfExempt(String path, String method) {
        if (USERS.equals(path) && "POST".equalsIgnoreCase(method)) {
            return true;
        }
        return CSRF_EXEMPT_ENDPOINTS.contains(path) || ERROR.equals(path)
                || ACTUATOR_HEALTH.equals(path);
    }
}
