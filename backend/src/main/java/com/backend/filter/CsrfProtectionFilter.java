package com.backend.filter;

import com.backend.config.CookieProperties;
import com.backend.config.PublicEndpoints;
import com.backend.util.FilterResponseUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

@Component
public class CsrfProtectionFilter extends OncePerRequestFilter {

    private static final String CSRF_COOKIE_NAME = "XSRF-TOKEN";
    private static final String CSRF_HEADER_NAME = "X-CSRF-Token";
    private static final int TOKEN_LENGTH = 32;
    private static final SecureRandom secureRandom = new SecureRandom();

    private final ObjectMapper objectMapper;
    private final CookieProperties cookieProperties;

    public CsrfProtectionFilter(ObjectMapper objectMapper,
                                CookieProperties cookieProperties) {
        this.objectMapper = objectMapper;
        this.cookieProperties = cookieProperties;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String path = request.getRequestURI();
        String method = request.getMethod();

        if (isSafeMethod(method)) {
            ensureCsrfTokenCookie(request, response);
            filterChain.doFilter(request, response);
            return;
        }

        if (PublicEndpoints.isCsrfExempt(path, method)) {
            filterChain.doFilter(request, response);
            return;
        }

        var cookieToken = getCsrfTokenFromCookie(request);
        String headerToken = request.getHeader(CSRF_HEADER_NAME);

        if (cookieToken == null || headerToken == null || !MessageDigest.isEqual(
                cookieToken.getBytes(StandardCharsets.UTF_8),
                headerToken.getBytes(StandardCharsets.UTF_8))) {
            sendCsrfErrorResponse(response);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean isSafeMethod(String method) {
        return "GET".equalsIgnoreCase(method) ||
                "HEAD".equalsIgnoreCase(method) ||
                "OPTIONS".equalsIgnoreCase(method);
    }

    private void ensureCsrfTokenCookie(HttpServletRequest request, HttpServletResponse response) {
        var existingToken = getCsrfTokenFromCookie(request);

        if (existingToken == null) {
            var newToken = generateCsrfToken();
            var cookie = ResponseCookie.from(CSRF_COOKIE_NAME, newToken)
                    .path("/")
                    .httpOnly(false)
                    .secure(cookieProperties.isSecure())
                    .maxAge(3600)
                    .sameSite(cookieProperties.getSameSite())
                    .build();
            response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        }
    }

    private String getCsrfTokenFromCookie(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return null;
        }
        for (Cookie cookie : request.getCookies()) {
            if (CSRF_COOKIE_NAME.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private String generateCsrfToken() {
        byte[] bytes = new byte[TOKEN_LENGTH];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private void sendCsrfErrorResponse(HttpServletResponse response) throws IOException {
        FilterResponseUtil.sendJsonError(response, HttpStatus.FORBIDDEN,
                "CSRF token validation failed. Please refresh the page and try again.", objectMapper);
    }
}
