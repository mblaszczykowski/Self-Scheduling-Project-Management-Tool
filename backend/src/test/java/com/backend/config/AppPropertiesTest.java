package com.backend.config;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import java.time.Duration;
import static org.assertj.core.api.Assertions.assertThat;

class AppPropertiesTest {
    @Test
    void validatesNestedConfigurationInsteadOfIgnoringItsConstraints() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var properties = new AppProperties();
            properties.getSse().setMaxEmittersPerUser(0);
            properties.getRateLimit().setWindowMs(0);
            properties.getSession().setAbsoluteMaxDays(0);
            assertThat(factory.getValidator().validate(properties))
                    .extracting(v -> v.getPropertyPath().toString())
                    .contains("sse.maxEmittersPerUser", "rateLimit.windowMs", "session.absoluteMaxDays");
        }
    }

    @Test
    void rejectsWildcardAndMalformedCredentialedCorsOrigins() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            for (var origin : java.util.List.of("*", "https://example.com/path", "not-an-origin")) {
                var properties = new AppProperties();
                properties.getCors().setAllowedOrigins(java.util.List.of(origin));
                assertThat(factory.getValidator().validate(properties)).isNotEmpty();
            }
            assertThat(factory.getValidator().validate(new AppProperties())).isEmpty();
        }
    }

    @Test
    void rejectsNonPositiveJwtLifetimeAndNegativeSkew() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var properties = new JwtProperties("unit-test-secret-with-at-least-32-characters",
                    Duration.ZERO, Duration.ofDays(7), Duration.ofSeconds(-1), "issuer", "audience");
            assertThat(factory.getValidator().validate(properties)).isNotEmpty();
        }
    }
}
