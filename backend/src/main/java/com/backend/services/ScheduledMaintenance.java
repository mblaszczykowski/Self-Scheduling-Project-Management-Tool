package com.backend.services;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;

import java.time.Duration;
import org.springframework.stereotype.Component;

@Component
public class ScheduledMaintenance {
    private static final Logger log = LoggerFactory.getLogger(ScheduledMaintenance.class);

    private static final Duration ORPHAN_MINIMUM_AGE = Duration.ofHours(6);

    private final TokenService tokenService;
    private final FileStorageService fileStorageService;

    public ScheduledMaintenance(TokenService tokenService, FileStorageService fileStorageService) {
        this.tokenService = tokenService;
        this.fileStorageService = fileStorageService;
    }

    @Scheduled(fixedDelay = 3_600_000, initialDelay = 300_000)
    public void deleteUnreferencedUploads() {
        try {
            int deleted = fileStorageService.deleteUnreferencedFiles(ORPHAN_MINIMUM_AGE);
            if (deleted > 0) {
                log.info("Deleted {} unreferenced upload(s)", deleted);
            }
        } catch (Exception e) {
            log.error("Unreferenced upload sweep failed", e);
        }
    }

    @Scheduled(fixedDelay = 3_600_000, initialDelay = 60_000)
    public void cleanupExpiredRefreshTokens() {
        try {
            int deleted = tokenService.cleanupExpiredTokens();
            if (deleted > 0) {
                log.info("Deleted {} expired refresh token(s)", deleted);
            }
        } catch (Exception e) {
            log.error("Expired refresh token cleanup failed", e);
        }
    }
}
