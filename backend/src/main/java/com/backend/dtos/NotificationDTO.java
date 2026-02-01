package com.backend.dtos;

import com.backend.entities.NotificationType;

import java.time.Instant;

public record NotificationDTO(
        Integer id,
        String message,
        Instant timestamp,
        Boolean isRead,
        NotificationType type,
        String link
) {}
