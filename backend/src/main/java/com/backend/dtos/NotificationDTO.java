package com.backend.dtos;

import com.backend.entities.NotificationType;

import java.util.Date;

public record NotificationDTO(
        Integer id,
        String message,
        Date timestamp,
        Boolean isRead,
        NotificationType type,
        String link
) {}
