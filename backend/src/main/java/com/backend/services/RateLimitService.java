package com.backend.services;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * In-memory, per-client fixed-window rate limiting. Owns the attempt state so both the
 * {@code RateLimitFilter} (enforcement) and {@code AuthService} (resetting on success) depend
 * on this component rather than on each other.
 */
@Service
public class RateLimitService {

    private final int maxLoginAttempts;
    private final int maxRegisterAttempts;
    private final int maxExistsAttempts;
    private final long windowMs;

    private final ConcurrentHashMap<String, Entry> loginAttempts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Entry> registerAttempts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Entry> existsAttempts = new ConcurrentHashMap<>();

    public RateLimitService(@Value("${rate-limit.max-login-attempts:5}") int maxLoginAttempts,
                            @Value("${rate-limit.max-register-attempts:3}") int maxRegisterAttempts,
                            @Value("${rate-limit.max-exists-attempts:30}") int maxExistsAttempts,
                            @Value("${rate-limit.window-ms:900000}") long windowMs) {
        this.maxLoginAttempts = maxLoginAttempts;
        this.maxRegisterAttempts = maxRegisterAttempts;
        this.maxExistsAttempts = maxExistsAttempts;
        this.windowMs = windowMs;
    }

    public long getWindowMs() {
        return windowMs;
    }

    public boolean allowLogin(String clientIp) {
        return allow(loginAttempts, clientIp, maxLoginAttempts);
    }

    public boolean allowRegister(String clientIp) {
        return allow(registerAttempts, clientIp, maxRegisterAttempts);
    }

    public boolean allowExists(String clientIp) {
        return allow(existsAttempts, clientIp, maxExistsAttempts);
    }

    public void resetLoginAttempts(String clientIp) {
        loginAttempts.remove(clientIp);
    }

    /**
     * Atomically records an attempt and reports whether it is within the limit; check and
     * increment happen in a single {@code compute} so concurrent requests cannot all pass first.
     */
    private boolean allow(ConcurrentHashMap<String, Entry> attempts, String clientIp, int max) {
        long now = System.currentTimeMillis();
        Entry entry = attempts.compute(clientIp, (key, existing) -> {
            if (existing == null || now - existing.windowStart > windowMs) {
                return new Entry(now);
            }
            existing.count.incrementAndGet();
            return existing;
        });
        return entry.count.get() <= max;
    }

    @Scheduled(fixedRate = 60000)
    public void cleanupExpiredEntries() {
        long now = System.currentTimeMillis();
        long expiryThreshold = windowMs * 2; // keep entries for 2x window before cleanup
        loginAttempts.entrySet().removeIf(e -> now - e.getValue().windowStart > expiryThreshold);
        registerAttempts.entrySet().removeIf(e -> now - e.getValue().windowStart > expiryThreshold);
        existsAttempts.entrySet().removeIf(e -> now - e.getValue().windowStart > expiryThreshold);
    }

    private static class Entry {
        final long windowStart;
        final AtomicInteger count;

        Entry(long windowStart) {
            this.windowStart = windowStart;
            this.count = new AtomicInteger(1);
        }
    }
}
