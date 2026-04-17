package com.backend.events;

import com.backend.entities.NotificationType;
import com.backend.entities.User;

public record NotificationEvent(
        User recipient,
        String message,
        NotificationType type,
        String link
) {}
