package com.backend.config;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Size;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

@ConfigurationProperties(prefix = "jwt")
@Validated
public record JwtProperties(
        @NotBlank @Size(min = 32, message = "JWT secret must be at least 32 characters") String secret,
        @NotNull Duration accessTokenExpiration,
        @NotNull Duration refreshTokenExpiration,
        Duration clockSkew,
        @NotBlank String issuer,
        @NotBlank String audience
) {
    public JwtProperties {
        if (clockSkew == null) clockSkew = Duration.ofSeconds(30);
    }

    @AssertTrue(message = "JWT expiration durations must be positive and clock skew must not be negative")
    public boolean isTimingConfigurationValid() {
        return accessTokenExpiration != null && !accessTokenExpiration.isNegative()
                && !accessTokenExpiration.isZero() && refreshTokenExpiration != null
                && !refreshTokenExpiration.isNegative() && !refreshTokenExpiration.isZero()
                && clockSkew != null && !clockSkew.isNegative();
    }
}
