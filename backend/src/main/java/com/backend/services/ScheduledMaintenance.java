package com.backend.services;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Periodic housekeeping. */
@Component
public class ScheduledMaintenance {

    private static final Logger log = LoggerFactory.getLogger(ScheduledMaintenance.class);

    private final TokenService tokenService;

    public ScheduledMaintenance(TokenService tokenService) {
        this.tokenService = tokenService;
    }

    @Scheduled(fixedDelay = 3_600_000, initialDelay = 60_000)
    public void cleanupExpiredRefreshTokens() {
        try {
            int deleted = tokenService.cleanupExpiredTokens();
            // Only worth a log line when something actually happened; the hourly no-op used to
            // write two INFO lines every time.
            if (deleted > 0) {
                log.info("Deleted {} expired refresh token(s)", deleted);
            }
        } catch (Exception e) {
            log.error("Expired refresh token cleanup failed", e);
        }
    }
}
