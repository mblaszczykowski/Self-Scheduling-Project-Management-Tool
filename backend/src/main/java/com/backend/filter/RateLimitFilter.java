package com.backend.filter;

import com.backend.config.PublicEndpoints;
import com.backend.util.FilterResponseUtil;
import com.backend.util.IpUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1) // right after SecurityHeaders, before authentication
public class RateLimitFilter extends OncePerRequestFilter {

    private final ObjectMapper objectMapper;
    private final Set<String> trustedProxies;
    private final int maxLoginAttempts;
    private final int maxRegisterAttempts;
    private final int maxExistsAttempts;
    private final long windowMs;

    private final ConcurrentHashMap<String, RateLimitEntry> loginAttempts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, RateLimitEntry> registerAttempts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, RateLimitEntry> existsAttempts = new ConcurrentHashMap<>();

    public RateLimitFilter(ObjectMapper objectMapper,
                          @Value("${app.trusted-proxies:}") String trustedProxiesConfig,
                          @Value("${rate-limit.max-login-attempts:5}") int maxLoginAttempts,
                          @Value("${rate-limit.max-register-attempts:3}") int maxRegisterAttempts,
                          @Value("${rate-limit.max-exists-attempts:30}") int maxExistsAttempts,
                          @Value("${rate-limit.window-ms:900000}") long windowMs) {
        this.objectMapper = objectMapper;
        this.trustedProxies = IpUtil.parseTrustedProxies(trustedProxiesConfig);
        this.maxLoginAttempts = maxLoginAttempts;
        this.maxRegisterAttempts = maxRegisterAttempts;
        this.maxExistsAttempts = maxExistsAttempts;
        this.windowMs = windowMs;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String path = request.getRequestURI();
        String method = request.getMethod();
        String clientIp = getClientIp(request);

        if (PublicEndpoints.RATE_LIMIT_LOGIN.equals(path) && "POST".equalsIgnoreCase(method)
                && !allowRequest(clientIp, loginAttempts, maxLoginAttempts)) {
            sendRateLimitResponse(response, "Too many login attempts. Please try again later.");
            return;
        }

        if (PublicEndpoints.RATE_LIMIT_REGISTER.equals(path) && "POST".equalsIgnoreCase(method)
                && !allowRequest(clientIp, registerAttempts, maxRegisterAttempts)) {
            sendRateLimitResponse(response, "Too many registration attempts. Please try again later.");
            return;
        }

        // Unauthenticated account-existence oracle — throttle to blunt enumeration.
        if (PublicEndpoints.USER_EXISTS.equals(path) && "GET".equalsIgnoreCase(method)
                && !allowRequest(clientIp, existsAttempts, maxExistsAttempts)) {
            sendRateLimitResponse(response, "Too many requests. Please try again later.");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private String getClientIp(HttpServletRequest request) {
        return IpUtil.getClientIp(request, trustedProxies);
    }

    /**
     * Atomically records an attempt and reports whether it is within the limit. Check and
     * increment happen in a single {@code compute} so a burst of concurrent requests cannot
     * all pass the check before any of them increments.
     */
    private boolean allowRequest(String clientIp, ConcurrentHashMap<String, RateLimitEntry> attempts, int max) {
        long now = System.currentTimeMillis();
        RateLimitEntry entry = attempts.compute(clientIp, (key, existing) -> {
            if (existing == null || now - existing.windowStart > windowMs) {
                return new RateLimitEntry(now);
            }
            existing.count.incrementAndGet();
            return existing;
        });
        return entry.count.get() <= max;
    }

    public void resetLoginAttempts(String clientIp) {
        loginAttempts.remove(clientIp);
    }

    @Scheduled(fixedRate = 60000)
    public void cleanupExpiredEntries() {
        long now = System.currentTimeMillis();
        long expiryThreshold = windowMs * 2; // Keep entries for 2x window before cleanup
        loginAttempts.entrySet().removeIf(e -> now - e.getValue().windowStart > expiryThreshold);
        registerAttempts.entrySet().removeIf(e -> now - e.getValue().windowStart > expiryThreshold);
        existsAttempts.entrySet().removeIf(e -> now - e.getValue().windowStart > expiryThreshold);
    }

    private void sendRateLimitResponse(HttpServletResponse response, String message) throws IOException {
        response.setHeader("Retry-After", String.valueOf(windowMs / 1000));
        FilterResponseUtil.sendJsonError(response, HttpStatus.TOO_MANY_REQUESTS, message, objectMapper);
    }

    private static class RateLimitEntry {
        final long windowStart;
        final AtomicInteger count;

        RateLimitEntry(long windowStart) {
            this.windowStart = windowStart;
            this.count = new AtomicInteger(1);
        }
    }
}
