package com.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Enables {@code @Scheduled}. Kept separate from the tasks themselves so that enabling the
 * feature and implementing a job are not the same file.
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
