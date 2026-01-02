package com.backend.config;

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

    @Autowired
    public ScheduledTasks(TokenService tokenService) {
        this.tokenService = tokenService;
    }

    @Scheduled(fixedDelay = 3600000, initialDelay = 60000)
    public void cleanupExpiredRefreshTokens() {
        logger.info("Starting cleanup of expired refresh tokens");
        try {
            tokenService.cleanupExpiredTokens();
            logger.info("Successfully cleaned up expired refresh tokens");
        } catch (Exception e) {
            logger.error("Error cleaning up expired refresh tokens", e);
        }
    }
}