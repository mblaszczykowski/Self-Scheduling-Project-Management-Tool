package com.backend.services;

import com.backend.entities.Notification;
import com.backend.entities.NotificationType;
import com.backend.entities.User;
import com.backend.exception.AuthorizationException;
import com.backend.repositories.NotificationRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class NotificationService {
    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Transactional
    public void createNotification(User recipient, String message, NotificationType type, String link) {
        var notification = new Notification();
        notification.setUser(recipient);
        notification.setMessage(message);
        notification.setType(type);
        notification.setTimestamp(Instant.now());
        notification.setLink(link);
        notificationRepository.save(notification);
    }

    @Transactional(readOnly = true)
    public List<Notification> getAllNotifications(Integer userId) {
        return notificationRepository.findByUserIdOrderByTimestampDesc(userId);
    }

    @Transactional(readOnly = true)
    public Page<Notification> getAllNotificationsPaged(Integer userId, Pageable pageable) {
        return notificationRepository.findByUserIdOrderByTimestampDesc(userId, pageable);
    }

    @Transactional
    public void markNotificationsAsRead(List<Integer> notificationIds, Integer userId) {
        var notifications = notificationRepository.findAllById(notificationIds);
        verifyOwnershipOfAllNotifications(notifications, userId);
        markAllAsRead(notifications);
        notificationRepository.saveAll(notifications);
    }

    private void verifyOwnershipOfAllNotifications(List<Notification> notifications, Integer userId) {
        for (var notification : notifications) {
            if (!notification.getUser().getId().equals(userId)) {
                throw new AuthorizationException("Access denied to notification");
            }
        }
    }

    private void markAllAsRead(List<Notification> notifications) {
        notifications.forEach(n -> n.setIsRead(true));
    }
}
