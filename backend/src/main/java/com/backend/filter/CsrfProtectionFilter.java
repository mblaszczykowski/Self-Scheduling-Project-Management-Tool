package com.backend.filter;

import com.backend.config.PublicEndpoints;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;

/**
 * CSRF protection using Double-Submit Cookie pattern.
 *
 * How it works:
 * 1. Server sets a random CSRF token in a readable cookie (XSRF-TOKEN)
 * 2. Client reads this cookie and sends it back in a header (X-CSRF-Token)
 * 3. Server validates that cookie value matches header value
 *
 * This works because:
 * - Attacker sites cannot read cookies from other domains (Same-Origin Policy)
 * - Attacker sites can make cross-origin requests but cannot set custom headers
 * - Only legitimate frontend can read the cookie and set the matching header
 */
@Component
public class CsrfProtectionFilter extends OncePerRequestFilter {

    private static final String CSRF_COOKIE_NAME = "XSRF-TOKEN";
    private static final String CSRF_HEADER_NAME = "X-CSRF-Token";
    private static final int TOKEN_LENGTH = 32;
    private static final SecureRandom secureRandom = new SecureRandom();

    private final ObjectMapper objectMapper;
    private final boolean secureCookie;
    private final String sameSite;

    public CsrfProtectionFilter(ObjectMapper objectMapper,
                                @Value("${app.cookie.secure:false}") boolean secureCookie,
                                @Value("${app.cookie.same-site:Lax}") String sameSite) {
        this.objectMapper = objectMapper;
        this.secureCookie = secureCookie;
        this.sameSite = sameSite;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String path = request.getRequestURI();
        String method = request.getMethod();

        // Skip CSRF for safe methods (GET, HEAD, OPTIONS)
        if (isSafeMethod(method)) {
            // For GET requests, ensure CSRF token cookie is set
            ensureCsrfTokenCookie(request, response);
            filterChain.doFilter(request, response);
            return;
        }

        // Skip CSRF for exempt endpoints and static content
        if (PublicEndpoints.isCsrfExempt(path, method)) {
            filterChain.doFilter(request, response);
            return;
        }

        // Validate CSRF token for state-changing requests
        String cookieToken = getCsrfTokenFromCookie(request);
        String headerToken = request.getHeader(CSRF_HEADER_NAME);

        if (cookieToken == null || headerToken == null || !cookieToken.equals(headerToken)) {
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
        String existingToken = getCsrfTokenFromCookie(request);

        if (existingToken == null) {
            String newToken = generateCsrfToken();
            Cookie cookie = new Cookie(CSRF_COOKIE_NAME, newToken);
            cookie.setPath("/");
            cookie.setHttpOnly(false); // Must be readable by JavaScript
            cookie.setSecure(secureCookie);
            cookie.setMaxAge(3600); // 1 hour
            response.addCookie(cookie);
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
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);

        Map<String, Object> error = Map.of(
                "status", HttpStatus.FORBIDDEN.value(),
                "error", "Forbidden",
                "message", "CSRF token validation failed. Please refresh the page and try again.",
                "timestamp", System.currentTimeMillis()
        );

        objectMapper.writeValue(response.getWriter(), error);
    }
}
