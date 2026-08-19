package com.backend.services;

import com.backend.config.AppProperties;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * In-memory fixed-window rate limiting, keyed per bucket.
 *
 * <p>State is per-JVM, which is correct for a single instance and must move to a shared store
 * (Redis) before running more than one replica — noted rather than pre-built, since the limits
 * that matter most (login, register) are already backed by per-account lockout semantics.
 */
@Service
public class RateLimitService {

    /** Named buckets, so a new limit is one enum constant plus one config property. */
    public enum Bucket {
        LOGIN,
        REGISTER,
        WRITE,
        OPTIMIZE,
        SEARCH,
        INVITATION
    }

    private final AppProperties.RateLimit config;
    private final Map<Bucket, ConcurrentHashMap<String, Entry>> buckets =
            new ConcurrentHashMap<>();

    public RateLimitService(AppProperties appProperties) {
        this.config = appProperties.getRateLimit();
        for (var bucket : Bucket.values()) {
            buckets.put(bucket, new ConcurrentHashMap<>());
        }
    }

    public long getWindowMs() {
        return config.getWindowMs();
    }

    /**
     * Records an attempt and reports whether it is within the bucket's limit. Check and
     * increment happen inside a single {@code compute} so concurrent requests cannot all pass.
     */
    public boolean allow(Bucket bucket, String key) {
        if (key == null || key.isBlank()) {
            key = "unknown";
        }
        int max = limitFor(bucket);
        long now = System.currentTimeMillis();
        var bucketMap = buckets.get(bucket);
        var entry = bucketMap.compute(key, (k, existing) -> {
            if (existing == null || now - existing.windowStart > config.getWindowMs()) {
                return new Entry(now);
            }
            existing.count.incrementAndGet();
            return existing;
        });
        return entry.count.get() <= max;
    }

    /**
     * Clears one key in one bucket. Used on a successful login for the (ip, email) key only:
     * clearing a coarse per-IP bucket on success would let anyone holding a single valid account
     * reset the counter every few guesses and brute-force indefinitely.
     */
    public void reset(Bucket bucket, String key) {
        if (key != null) {
            buckets.get(bucket).remove(key);
        }
    }

    /** Composite key so a login flood against one account cannot lock out an entire office NAT. */
    public static String loginKey(String clientIp, String email) {
        var normalized = email == null ? "" : email.toLowerCase().trim();
        return clientIp + "|" + normalized;
    }

    private int limitFor(Bucket bucket) {
        return switch (bucket) {
            case LOGIN -> config.getLogin();
            case REGISTER -> config.getRegister();
            case WRITE -> config.getWrite();
            case OPTIMIZE -> config.getOptimize();
            case SEARCH -> config.getSearch();
            case INVITATION -> config.getInvitation();
        };
    }

    /**
     * Reclaims entries whose window has long closed. This sweep is the only thing that bounds a
     * bucket's size, deliberately: a capacity cap that evicted the oldest entry would hand that
     * key a fresh budget the moment the map filled, and the LOGIN bucket is keyed partly on a
     * caller-supplied email, so flooding it with distinct keys would reset the limiter for whoever
     * happened to be oldest — trading a memory bound for a rate-limit bypass. Bounding key
     * cardinality safely needs a coarser key or a store with its own eviction, not an eviction
     * policy layered over this map.
     */
    @Scheduled(fixedRate = 60_000)
    public void cleanupExpiredEntries() {
        long now = System.currentTimeMillis();
        long expiryThreshold = config.getWindowMs() * 2;
        buckets.values().forEach(bucket ->
                bucket.entrySet().removeIf(e -> now - e.getValue().windowStart > expiryThreshold));
    }

    private static final class Entry {
        final long windowStart;
        final AtomicInteger count;

        Entry(long windowStart) {
            this.windowStart = windowStart;
            this.count = new AtomicInteger(1);
        }
    }
}
