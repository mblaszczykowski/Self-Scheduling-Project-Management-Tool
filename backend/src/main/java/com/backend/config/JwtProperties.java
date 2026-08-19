package com.backend.config;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

@ConfigurationProperties(prefix = "jwt")
@Validated
public record JwtProperties(
        @NotNull @Size(min = 32, message = "JWT secret must be at least 32 characters") String secret,
        @NotNull Duration accessTokenExpiration,
        @NotNull Duration refreshTokenExpiration,
        Duration clockSkew,
        @NotNull String issuer,
        @NotNull String audience
) {
    public JwtProperties {
        if (clockSkew == null) clockSkew = Duration.ofSeconds(30);
    }
}
