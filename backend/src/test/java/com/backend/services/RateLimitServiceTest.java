package com.backend.services;

import com.backend.config.AppProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("RateLimitService")
class RateLimitServiceTest {
    private static RateLimitService withLoginLimit(int limit) {
        var appProperties = new AppProperties();
        appProperties.getRateLimit().setLogin(limit);
        return new RateLimitService(appProperties);
    }

    private static RateLimitService withLoginLimitAndWindow(int limit, long windowMs) {
        var appProperties = new AppProperties();
        appProperties.getRateLimit().setLogin(limit);
        appProperties.getRateLimit().setWindowMs(windowMs);
        return new RateLimitService(appProperties);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, ?> bucketContents(RateLimitService limiter, RateLimitService.Bucket bucket)
            throws Exception {
        Field field = RateLimitService.class.getDeclaredField("buckets");
        field.setAccessible(true);
        var buckets = (Map<RateLimitService.Bucket, ? extends Map<String, ?>>) field.get(limiter);
        return buckets.get(bucket);
    }

    @Nested
    @DisplayName("Counting within a window")
    class Counting {
        @Test
        @DisplayName("allows exactly the configured number of attempts, then refuses")
        void allowsUpToTheLimit() {
            var limiter = withLoginLimit(3);

            assertThat(limiter.allow(RateLimitService.Bucket.LOGIN, "a@b.c")).isTrue();
            assertThat(limiter.allow(RateLimitService.Bucket.LOGIN, "a@b.c")).isTrue();
            assertThat(limiter.allow(RateLimitService.Bucket.LOGIN, "a@b.c")).isTrue();
            assertThat(limiter.allow(RateLimitService.Bucket.LOGIN, "a@b.c")).isFalse();
        }

        @Test
        @DisplayName("counts each key separately")
        void countsPerKey() {
            var limiter = withLoginLimit(1);

            assertThat(limiter.allow(RateLimitService.Bucket.LOGIN, "one@b.c")).isTrue();
            assertThat(limiter.allow(RateLimitService.Bucket.LOGIN, "two@b.c")).isTrue();
            assertThat(limiter.allow(RateLimitService.Bucket.LOGIN, "one@b.c")).isFalse();
        }

        @Test
        @DisplayName("counts a blank or null key under one shared bucket entry")
        void foldsBlankKeys() {
            var limiter = withLoginLimit(1);

            assertThat(limiter.allow(RateLimitService.Bucket.LOGIN, null)).isTrue();
            assertThat(limiter.allow(RateLimitService.Bucket.LOGIN, "  ")).isFalse();
        }

        @Test
        @DisplayName("reset clears one key without touching its neighbours")
        void resetClearsOneKey() {
            var limiter = withLoginLimit(1);
            limiter.allow(RateLimitService.Bucket.LOGIN, "mine@b.c");
            limiter.allow(RateLimitService.Bucket.LOGIN, "theirs@b.c");

            limiter.reset(RateLimitService.Bucket.LOGIN, "mine@b.c");

            assertThat(limiter.allow(RateLimitService.Bucket.LOGIN, "mine@b.c")).isTrue();
            assertThat(limiter.allow(RateLimitService.Bucket.LOGIN, "theirs@b.c")).isFalse();
        }
    }

    @Nested
    @DisplayName("Key-space pressure must not reset anyone's budget")
    class KeySpacePressure {
        @Test
        @DisplayName("a flood of distinct keys leaves an exhausted key still refused")
        void floodingDoesNotResetAnExhaustedKey() {
            var limiter = withLoginLimit(3);
            var victim = "victim@example.com";
            for (int i = 0; i < 3; i++) {
                limiter.allow(RateLimitService.Bucket.LOGIN, victim);
            }
            assertThat(limiter.allow(RateLimitService.Bucket.LOGIN, victim)).isFalse();

            for (int i = 0; i < 20_000; i++) {
                limiter.allow(RateLimitService.Bucket.LOGIN, "decoy-" + i + "@example.com");
            }

            assertThat(limiter.allow(RateLimitService.Bucket.LOGIN, victim)).isFalse();
        }
    }

    @Nested
    @DisplayName("Fixed window reset")
    class WindowReset {
        @Test
        @DisplayName("refuses inside the window, then allows again once the window rolls over")
        void resetsOnceTheWindowRolls() throws InterruptedException {
            var limiter = withLoginLimitAndWindow(1, 40);

            assertThat(limiter.allow(RateLimitService.Bucket.LOGIN, "roller@b.c")).isTrue();
            assertThat(limiter.allow(RateLimitService.Bucket.LOGIN, "roller@b.c"))
                    .as("still inside the same window").isFalse();

            Thread.sleep(120);

            assertThat(limiter.allow(RateLimitService.Bucket.LOGIN, "roller@b.c"))
                    .as("the window has rolled over, so the counter starts fresh").isTrue();
        }
    }

    @Nested
    @DisplayName("Expiry sweep")
    class Sweep {
        @Test
        @DisplayName("leaves a live entry's count intact")
        void keepsLiveEntries() {
            var limiter = withLoginLimit(2);
            limiter.allow(RateLimitService.Bucket.LOGIN, "live@b.c");
            limiter.allow(RateLimitService.Bucket.LOGIN, "live@b.c");

            limiter.cleanupExpiredEntries();

            assertThat(limiter.allow(RateLimitService.Bucket.LOGIN, "live@b.c")).isFalse();
        }

        @Test
        @DisplayName("removes an entry whose window closed long ago")
        void removesLongExpiredEntries() throws Exception {
            var limiter = withLoginLimitAndWindow(5, 10);
            limiter.allow(RateLimitService.Bucket.LOGIN, "stale@b.c");
            assertThat(bucketContents(limiter, RateLimitService.Bucket.LOGIN))
                    .containsKey("stale@b.c");

            Thread.sleep(60);
            limiter.cleanupExpiredEntries();

            assertThat(bucketContents(limiter, RateLimitService.Bucket.LOGIN))
                    .as("the sweep is the only thing that bounds a bucket's size")
                    .doesNotContainKey("stale@b.c");
        }
    }
}
