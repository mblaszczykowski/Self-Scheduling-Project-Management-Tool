package com.backend.services;

import com.backend.config.AppProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("RateLimitService")
class RateLimitServiceTest {

    private static RateLimitService withLoginLimit(int limit) {
        var appProperties = new AppProperties();
        appProperties.getRateLimit().setLogin(limit);
        return new RateLimitService(appProperties);
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

            // The LOGIN bucket is keyed partly on a caller-supplied email, so distinct keys are
            // free to generate. An eviction policy that dropped the oldest entry under this
            // pressure handed the victim's key a fresh budget — a rate-limit bypass rather than a
            // memory bound.
            for (int i = 0; i < 20_000; i++) {
                limiter.allow(RateLimitService.Bucket.LOGIN, "decoy-" + i + "@example.com");
            }

            assertThat(limiter.allow(RateLimitService.Bucket.LOGIN, victim)).isFalse();
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
    }
}
