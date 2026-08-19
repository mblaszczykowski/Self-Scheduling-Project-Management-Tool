package com.backend.filter;

import com.backend.config.PublicEndpoints;
import com.backend.services.RateLimitService;
import com.backend.services.RateLimitService.Bucket;
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

/**
 * Coarse per-client throttling, applied before authentication.
 *
 * <p>The client address comes from {@code request.getRemoteAddr()}, which Tomcat's RemoteIpValve
 * has already resolved from {@code X-Forwarded-For} for trusted proxies (see
 * {@code server.forward-headers-strategy} and {@code server.tomcat.remoteip.internal-proxies}).
 * A request arriving from an untrusted peer keeps that peer's address, so the header cannot be
 * spoofed to evade or to poison another client's bucket.
 *
 * <p>Login is throttled per (address, email) rather than per address: a shared office NAT must
 * not be able to lock everyone out, and a flood against one account must still be stopped.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1) // right after SecurityHeaders, before authentication
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    private final ObjectMapper objectMapper;
    private final RateLimitService rateLimitService;

    public RateLimitFilter(ObjectMapper objectMapper, RateLimitService rateLimitService) {
        this.objectMapper = objectMapper;
        this.rateLimitService = rateLimitService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        var path = request.getRequestURI();
        var method = request.getMethod();
        var clientIp = request.getRemoteAddr();

        if (PublicEndpoints.USERS.equals(path) && "POST".equalsIgnoreCase(method)
                && !rateLimitService.allow(Bucket.REGISTER, clientIp)) {
            reject(response, clientIp, path, "Too many registration attempts. Please try again later.");
            return;
        }

        // Login is keyed on (ip, email); the email is only available to AuthService, which owns
        // that check. Here we only guard the endpoints keyed purely on the client address.
        if (!isPreflight(method) && path.startsWith("/api/optimization/")
                && !rateLimitService.allow(Bucket.OPTIMIZE, clientIp)) {
            reject(response, clientIp, path, "Too many optimization requests. Please try again later.");
            return;
        }

        if (!isPreflight(method) && path.startsWith("/api/search")
                && !rateLimitService.allow(Bucket.SEARCH, clientIp)) {
            reject(response, clientIp, path, "Too many search requests. Please try again later.");
            return;
        }

        if (isWrite(method) && path.startsWith("/api/")
                && !rateLimitService.allow(Bucket.WRITE, clientIp)) {
            reject(response, clientIp, path, "Too many requests. Please slow down and try again.");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private static boolean isWrite(String method) {
        return "POST".equalsIgnoreCase(method)
                || "PUT".equalsIgnoreCase(method)
                || "PATCH".equalsIgnoreCase(method)
                || "DELETE".equalsIgnoreCase(method);
    }

    private static boolean isPreflight(String method) {
        return "OPTIONS".equalsIgnoreCase(method);
    }

    private void reject(HttpServletResponse response, String clientIp, String path, String message)
            throws IOException {
        log.warn("Rate limit exceeded: client={} path={}", clientIp, path);
        response.setHeader("Retry-After", String.valueOf(rateLimitService.getWindowMs() / 1000));
        FilterResponseUtil.sendJsonError(response, HttpStatus.TOO_MANY_REQUESTS, message,
                objectMapper, "RATE_LIMITED");
    }
}
