package com.backend.filter;

import com.backend.config.PublicEndpoints;
import com.backend.services.TokenService;
import com.backend.util.FilterResponseUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final TokenService tokenService;
    private final ObjectMapper objectMapper;

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

        if (PublicEndpoints.isPublicForJwt(path, method)) {
            filterChain.doFilter(request, response);
            return;
        }

        if ("OPTIONS".equalsIgnoreCase(method)) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            String token = tokenService.extractTokenFromRequest(request);
            if (token == null) {
                sendErrorResponse(response, HttpStatus.UNAUTHORIZED, "Missing authentication token");
                return;
            }

            Integer userId = tokenService.validateTokenAndGetUserId(token);
            if (userId == null) {
                sendErrorResponse(response, HttpStatus.UNAUTHORIZED, "Invalid or expired token");
                return;
            }

            request.setAttribute("userId", userId);
            filterChain.doFilter(request, response);

        } catch (Exception e) {
            sendErrorResponse(response, HttpStatus.UNAUTHORIZED, "Authentication failed");
        }
    }

    private void sendErrorResponse(HttpServletResponse response,
                                   HttpStatus status,
                                   String message) throws IOException {
        FilterResponseUtil.sendJsonError(response, status, message, objectMapper,
                Map.of("code", "AUTH_ERROR"));
    }
}