package com.backend.filter;

import com.backend.config.PublicEndpoints;
import com.backend.util.FilterResponseUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private final ObjectMapper objectMapper;
    private final Set<String> trustedProxies;
    private final int maxLoginAttempts;
    private final int maxRegisterAttempts;
    private final long windowMs;

    private final ConcurrentHashMap<String, RateLimitEntry> loginAttempts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, RateLimitEntry> registerAttempts = new ConcurrentHashMap<>();

    public RateLimitFilter(ObjectMapper objectMapper,
                          @Value("${app.trusted-proxies:}") String trustedProxiesConfig,
                          @Value("${rate-limit.max-login-attempts:5}") int maxLoginAttempts,
                          @Value("${rate-limit.max-register-attempts:3}") int maxRegisterAttempts,
                          @Value("${rate-limit.window-ms:900000}") long windowMs) {
        this.objectMapper = objectMapper;
        this.trustedProxies = com.backend.util.IpUtil.parseTrustedProxies(trustedProxiesConfig);
        this.maxLoginAttempts = maxLoginAttempts;
        this.maxRegisterAttempts = maxRegisterAttempts;
        this.windowMs = windowMs;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String path = request.getRequestURI();
        String method = request.getMethod();
        String clientIp = getClientIp(request);

        if (PublicEndpoints.RATE_LIMIT_LOGIN.equals(path) && "POST".equalsIgnoreCase(method)) {
            if (isRateLimited(clientIp, loginAttempts, maxLoginAttempts)) {
                sendRateLimitResponse(response, "Too many login attempts. Please try again in 15 minutes.");
                return;
            }
            incrementAttempts(clientIp, loginAttempts);
        }

        if (PublicEndpoints.RATE_LIMIT_REGISTER.equals(path) && "POST".equalsIgnoreCase(method)) {
            if (isRateLimited(clientIp, registerAttempts, maxRegisterAttempts)) {
                sendRateLimitResponse(response, "Too many registration attempts. Please try again later.");
                return;
            }
            incrementAttempts(clientIp, registerAttempts);
        }

        filterChain.doFilter(request, response);
    }

    private String getClientIp(HttpServletRequest request) {
        return com.backend.util.IpUtil.getClientIp(request, trustedProxies);
    }

    private boolean isRateLimited(String clientIp, ConcurrentHashMap<String, RateLimitEntry> attempts, int maxAttempts) {
        RateLimitEntry entry = attempts.get(clientIp);
        if (entry == null) {
            return false;
        }

        long now = System.currentTimeMillis();

        if (now - entry.windowStart > windowMs) {
            attempts.remove(clientIp);
            return false;
        }

        return entry.count.get() >= maxAttempts;
    }

    private void incrementAttempts(String clientIp, ConcurrentHashMap<String, RateLimitEntry> attempts) {
        long now = System.currentTimeMillis();

        attempts.compute(clientIp, (key, existing) -> {
            if (existing == null || now - existing.windowStart > windowMs) {
                return new RateLimitEntry(now);
            }
            existing.count.incrementAndGet();
            return existing;
        });
    }

    public void resetLoginAttempts(String clientIp) {
        loginAttempts.remove(clientIp);
    }

    @Scheduled(fixedRate = 60000)
    public void cleanupExpiredEntries() {
        long now = System.currentTimeMillis();
        long expiryThreshold = windowMs * 2; // Keep entries for 2x window before cleanup

        loginAttempts.entrySet().removeIf(entry ->
                now - entry.getValue().windowStart > expiryThreshold
        );
        registerAttempts.entrySet().removeIf(entry ->
                now - entry.getValue().windowStart > expiryThreshold
        );
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