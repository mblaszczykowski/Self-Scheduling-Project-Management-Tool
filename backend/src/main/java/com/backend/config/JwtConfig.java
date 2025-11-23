package com.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.Base64;

@Configuration
public class JwtConfig {

    @Value("${jwt.secret}")
    private String secretKey;

    @Value("${jwt.access-token-expiration:15}")
    private int accessTokenExpirationMinutes;

    @Value("${jwt.refresh-token-expiration:7}")
    private int refreshTokenExpirationDays;

    @Bean
    public SecretKey jwtSecretKey() {
        try {
            // Hash the secret key for better entropy
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(secretKey.getBytes(StandardCharsets.UTF_8));
            return new SecretKeySpec(hash, "HmacSHA256");
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("Error creating JWT secret key", e);
        }
    }

    @Bean
    public Duration accessTokenExpiration() {
        return Duration.ofMinutes(accessTokenExpirationMinutes);
    }

    @Bean
    public Duration refreshTokenExpiration() {
        return Duration.ofDays(refreshTokenExpirationDays);
    }
}