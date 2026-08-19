package com.backend.filter;

import com.backend.config.PublicEndpoints;
import com.backend.services.TokenService;
import com.backend.web.FilterResponseUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 2)
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

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
        var path = request.getRequestURI();
        var method = request.getMethod();

        if (PublicEndpoints.isPublicForJwt(path, method) || "OPTIONS".equalsIgnoreCase(method)) {
            filterChain.doFilter(request, response);
            return;
        }

        Integer userId;
        try {
            var token = tokenService.extractTokenFromRequest(request);
            if (token == null) {
                reject(request, response, "Missing authentication token", "no token presented");
                return;
            }
            userId = tokenService.validateTokenAndGetUserId(token);
        } catch (Exception e) {
            log.error("Unexpected failure while authenticating {} {}",
                    request.getMethod(), request.getRequestURI(), e);
            reject(request, response, "Authentication failed", "token processing error");
            return;
        }

        if (userId == null) {
            reject(request, response, "Invalid or expired token", "token rejected");
            return;
        }

        request.setAttribute(TokenService.USER_ID_ATTRIBUTE, userId);
        filterChain.doFilter(request, response);
    }

    private void reject(HttpServletRequest request, HttpServletResponse response,
                        String clientMessage, String reason) throws IOException {
        log.debug("Authentication rejected ({}): client={} method={} path={}",
                reason, request.getRemoteAddr(), request.getMethod(), request.getRequestURI());
        FilterResponseUtil.sendJsonError(response, HttpStatus.UNAUTHORIZED, clientMessage,
                objectMapper, "AUTH_ERROR");
    }
}
