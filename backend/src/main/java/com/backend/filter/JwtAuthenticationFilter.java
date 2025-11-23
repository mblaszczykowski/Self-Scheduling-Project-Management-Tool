package com.backend.filter;

import com.backend.services.TokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final TokenService tokenService;
    private final ObjectMapper objectMapper;

    // Public endpoints that don't require authentication
    private static final Set<String> PUBLIC_ENDPOINTS = Set.of(
            "/api/auth/login",
            "/api/auth/refresh",
            "/api/users"  // POST only for registration
    );

    public JwtAuthenticationFilter(TokenService tokenService, ObjectMapper objectMapper) {
        this.tokenService = tokenService;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String path = request.getRequestURI();
        String method = request.getMethod();

        // Skip authentication for public endpoints
        if (isPublicEndpoint(path, method)) {
            filterChain.doFilter(request, response);
            return;
        }

        // Skip OPTIONS requests (CORS preflight)
        if ("OPTIONS".equalsIgnoreCase(method)) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            // Extract and validate token
            String token = tokenService.extractTokenFromRequest(request);
            if (token == null) {
                sendErrorResponse(response, HttpStatus.UNAUTHORIZED, "Missing authentication token");
                return;
            }

            // Validate and get user ID
            Integer userId = tokenService.validateTokenAndGetUserId(token);
            if (userId == null) {
                sendErrorResponse(response, HttpStatus.UNAUTHORIZED, "Invalid or expired token");
                return;
            }

            // Store user ID in request for downstream use
            request.setAttribute("userId", userId);

            filterChain.doFilter(request, response);

        } catch (Exception e) {
            sendErrorResponse(response, HttpStatus.UNAUTHORIZED, "Authentication failed");
        }
    }

    private boolean isPublicEndpoint(String path, String method) {
        // Check exact matches
        if (PUBLIC_ENDPOINTS.contains(path)) {
            // Special case: /api/users is only public for POST (registration)
            if ("/api/users".equals(path)) {
                return "POST".equalsIgnoreCase(method);
            }
            return true;
        }

        // Check if it's a static resource or error endpoint
        return path.startsWith("/static/") ||
                path.startsWith("/uploads/") ||
                path.equals("/error");
    }

    private void sendErrorResponse(HttpServletResponse response,
                                   HttpStatus status,
                                   String message) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);

        Map<String, Object> error = new HashMap<>();
        error.put("status", status.value());
        error.put("error", status.getReasonPhrase());
        error.put("message", message);
        error.put("timestamp", System.currentTimeMillis());

        objectMapper.writeValue(response.getWriter(), error);
    }
}