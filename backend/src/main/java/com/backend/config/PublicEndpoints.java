package com.backend.config;

import java.util.Set;

public final class PublicEndpoints {

    private PublicEndpoints() {
    }

    public static final String LOGIN = "/api/auth/login";
    public static final String REFRESH = "/api/auth/refresh";
    public static final String LOGOUT = "/api/auth/logout";

    public static final String USERS = "/api/users";
    public static final String USER_EXISTS = "/api/users/exists";

    public static final String FILES_PREFIX = "/files/";
    public static final String UPLOADS_PREFIX = "/uploads/";
    public static final String STATIC_PREFIX = "/static/";

    public static final String ERROR = "/error";

    public static final Set<String> JWT_EXEMPT_ENDPOINTS = Set.of(
            LOGIN,
            REFRESH,
            USERS,
            USER_EXISTS
    );

    public static final Set<String> CSRF_EXEMPT_ENDPOINTS = Set.of(
            LOGIN,
            REFRESH,
            USER_EXISTS
    );

    public static final String RATE_LIMIT_LOGIN = LOGIN;
    public static final String RATE_LIMIT_REGISTER = USERS;

    public static boolean isStaticContentPath(String path) {
        return path.startsWith(UPLOADS_PREFIX) ||
                path.startsWith(STATIC_PREFIX) ||
                path.equals(ERROR);
    }

    public static boolean isPublicForJwt(String path, String method) {
        if (JWT_EXEMPT_ENDPOINTS.contains(path)) {
            if (USERS.equals(path)) {
                return "POST".equalsIgnoreCase(method);
            }
            return true;
        }
        return isStaticContentPath(path);
    }

    public static boolean isCsrfExempt(String path, String method) {
        if (USERS.equals(path) && "POST".equalsIgnoreCase(method)) {
            return true;
        }
        return CSRF_EXEMPT_ENDPOINTS.contains(path) || isStaticContentPath(path);
    }
}
