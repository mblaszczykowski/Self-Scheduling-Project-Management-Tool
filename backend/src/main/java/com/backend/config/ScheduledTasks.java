package com.backend.config;

import com.backend.services.AuthService;
import com.backend.services.TokenService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration
@EnableScheduling
public class ScheduledTasks {

    private static final Logger logger = LoggerFactory.getLogger(ScheduledTasks.class);

    private final TokenService tokenService;
    private final AuthService authService;

    @Autowired
    public ScheduledTasks(TokenService tokenService, AuthService authService) {
        this.tokenService = tokenService;
        this.authService = authService;
    }

    // Clean up expired refresh tokens every hour
    @Scheduled(fixedDelay = 3600000) // 1 hour in milliseconds
    public void cleanupExpiredRefreshTokens() {
        logger.info("Starting cleanup of expired refresh tokens");
        try {
            tokenService.cleanupExpiredTokens();
            logger.info("Successfully cleaned up expired refresh tokens");
        } catch (Exception e) {
            logger.error("Error cleaning up expired refresh tokens", e);
        }
    }

    // Clean up old login attempts every 30 minutes
    @Scheduled(fixedDelay = 1800000) // 30 minutes in milliseconds
    public void cleanupOldLoginAttempts() {
        logger.info("Starting cleanup of old login attempts");
        try {
            authService.cleanupOldAttempts();
            logger.info("Successfully cleaned up old login attempts");
        } catch (Exception e) {
            logger.error("Error cleaning up old login attempts", e);
        }
    }
}