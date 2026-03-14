package com.backend.filter;

import com.backend.config.PublicEndpoints;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private final ObjectMapper objectMapper;

    private static final int MAX_LOGIN_ATTEMPTS = 5;
    private static final int MAX_REGISTER_ATTEMPTS = 3;
    private static final long WINDOW_MS = 15 * 60 * 1000;

    private final ConcurrentHashMap<String, RateLimitEntry> loginAttempts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, RateLimitEntry> registerAttempts = new ConcurrentHashMap<>();

    public RateLimitFilter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String path = request.getRequestURI();
        String method = request.getMethod();
        String clientIp = getClientIp(request);

        if (PublicEndpoints.RATE_LIMIT_LOGIN.equals(path) && "POST".equalsIgnoreCase(method)) {
            if (isRateLimited(clientIp, loginAttempts, MAX_LOGIN_ATTEMPTS)) {
                sendRateLimitResponse(response, "Too many login attempts. Please try again in 15 minutes.");
                return;
            }
            incrementAttempts(clientIp, loginAttempts);
        }

        if (PublicEndpoints.RATE_LIMIT_REGISTER.equals(path) && "POST".equalsIgnoreCase(method)) {
            if (isRateLimited(clientIp, registerAttempts, MAX_REGISTER_ATTEMPTS)) {
                sendRateLimitResponse(response, "Too many registration attempts. Please try again later.");
                return;
            }
            incrementAttempts(clientIp, registerAttempts);
        }

        filterChain.doFilter(request, response);
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }
        return request.getRemoteAddr();
    }

    private boolean isRateLimited(String clientIp, ConcurrentHashMap<String, RateLimitEntry> attempts, int maxAttempts) {
        RateLimitEntry entry = attempts.get(clientIp);
        if (entry == null) {
            return false;
        }

        long now = System.currentTimeMillis();

        if (now - entry.windowStart > WINDOW_MS) {
            attempts.remove(clientIp);
            return false;
        }

        return entry.count.get() >= maxAttempts;
    }

    private void incrementAttempts(String clientIp, ConcurrentHashMap<String, RateLimitEntry> attempts) {
        long now = System.currentTimeMillis();

        attempts.compute(clientIp, (key, existing) -> {
            if (existing == null || now - existing.windowStart > WINDOW_MS) {
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
        long expiryThreshold = WINDOW_MS * 2; // Keep entries for 2x window before cleanup

        loginAttempts.entrySet().removeIf(entry ->
                now - entry.getValue().windowStart > expiryThreshold
        );
        registerAttempts.entrySet().removeIf(entry ->
                now - entry.getValue().windowStart > expiryThreshold
        );
    }

    private void sendRateLimitResponse(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setHeader("Retry-After", String.valueOf(WINDOW_MS / 1000));

        Map<String, Object> error = Map.of(
                "status", HttpStatus.TOO_MANY_REQUESTS.value(),
                "error", "Too Many Requests",
                "message", message,
                "timestamp", System.currentTimeMillis()
        );

        objectMapper.writeValue(response.getWriter(), error);
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