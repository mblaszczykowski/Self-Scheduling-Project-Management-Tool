package com.backend.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Filter that adds security headers to all HTTP responses.
 * These headers protect against common web vulnerabilities.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SecurityHeadersFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        // Prevent MIME type sniffing - stops browsers from interpreting files as different MIME types
        response.setHeader("X-Content-Type-Options", "nosniff");

        // Prevent clickjacking - stops the page from being embedded in iframes
        response.setHeader("X-Frame-Options", "DENY");

        // XSS protection for older browsers
        response.setHeader("X-XSS-Protection", "1; mode=block");

        // Content Security Policy - restricts sources of content
        // Note: 'unsafe-inline' for styles required by many CSS-in-JS solutions and Tailwind
        // 'unsafe-eval' removed - not needed for production React builds
        response.setHeader("Content-Security-Policy",
                "default-src 'self'; " +
                "script-src 'self'; " +
                "style-src 'self' 'unsafe-inline'; " +
                "img-src 'self' data: blob: https:; " +
                "font-src 'self' data:; " +
                "connect-src 'self'; " +
                "frame-ancestors 'none';");

        // Referrer policy - controls how much referrer information is sent
        response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

        // Permissions policy - disable unnecessary browser features
        response.setHeader("Permissions-Policy",
                "geolocation=(), microphone=(), camera=(), payment=()");

        // Cache control for sensitive endpoints
        String path = request.getRequestURI();
        if (path.startsWith("/api/")) {
            response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
            response.setHeader("Pragma", "no-cache");
        }

        filterChain.doFilter(request, response);
    }
}