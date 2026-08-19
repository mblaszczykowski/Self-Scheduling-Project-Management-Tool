package com.backend.services;

import com.backend.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class RateLimitService {
    private static final Logger log = LoggerFactory.getLogger(RateLimitService.class);

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

    public void reset(Bucket bucket, String key) {
        if (key != null) {
            buckets.get(bucket).remove(key);
        }
    }

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

    @Scheduled(fixedRate = 60_000)
    public void cleanupExpiredEntries() {
        try {
            long now = System.currentTimeMillis();
            long expiryThreshold = config.getWindowMs() * 2;
            buckets.values().forEach(bucket ->
                    bucket.entrySet().removeIf(e -> now - e.getValue().windowStart > expiryThreshold));
        } catch (Exception e) {
            log.error("Rate limit bucket sweep failed", e);
        }
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
