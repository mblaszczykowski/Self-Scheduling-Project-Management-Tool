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
 * Security headers for responses this application serves.
 *
 * <p>These cover the API and file downloads. The HTML document is served by nginx, which sets
 * the same policy itself — a CSP delivered on a JSON response does not constrain the document
 * that loaded the scripts, so both halves are needed and {@code nginx.conf} is the other half.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SecurityHeadersFilter extends OncePerRequestFilter {

    private static final String CSP = String.join(" ",
            "default-src 'self';",
            "script-src 'self';",
            "style-src 'self' 'unsafe-inline';",
            "img-src 'self' data: blob:;",
            "font-src 'self' data:;",
            "connect-src 'self';",
            "object-src 'none';",
            "base-uri 'self';",
            "form-action 'self';",
            "frame-ancestors 'none';");

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");
        // 0 disables the legacy, deprecated XSS auditor; the CSP is the real protection.
        response.setHeader("X-XSS-Protection", "0");
        response.setHeader("Content-Security-Policy", CSP);
        response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        response.setHeader("Permissions-Policy",
                "geolocation=(), microphone=(), camera=(), payment=()");

        // Only pin HTTPS when the request actually arrived over it. Emitting HSTS on plain HTTP
        // would pin a developer's browser to a scheme their local setup does not serve.
        if (isSecure(request)) {
            response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        }

        if (request.getRequestURI().startsWith("/api/")) {
            response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
            response.setHeader("Pragma", "no-cache");
        }

        filterChain.doFilter(request, response);
    }

    private static boolean isSecure(HttpServletRequest request) {
        // request.isSecure() already accounts for X-Forwarded-Proto when Tomcat's RemoteIpValve
        // is enabled via server.forward-headers-strategy.
        return request.isSecure();
    }
}
