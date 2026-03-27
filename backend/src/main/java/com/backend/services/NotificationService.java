package com.backend.services;

import com.backend.dtos.NotificationDTO;
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
    private final SseEmitterManager sseEmitterManager;

    public NotificationService(NotificationRepository notificationRepository,
                               SseEmitterManager sseEmitterManager) {
        this.notificationRepository = notificationRepository;
        this.sseEmitterManager = sseEmitterManager;
    }

    @Transactional(rollbackFor = Exception.class)
    public void createNotification(User recipient, String message, NotificationType type, String link) {
        var notification = new Notification();
        notification.setUser(recipient);
        notification.setMessage(message);
        notification.setType(type);
        notification.setTimestamp(Instant.now());
        notification.setLink(link);
        notificationRepository.save(notification);

        sseEmitterManager.sendNotification(recipient.getId(), convertToDTO(notification));
    }

    @Transactional(readOnly = true)
    public List<Notification> getAllNotifications(Integer userId) {
        return notificationRepository.findByUserIdOrderByTimestampDesc(userId);
    }

    @Transactional(readOnly = true)
    public Page<Notification> getAllNotificationsPaged(Integer userId, Pageable pageable) {
        return notificationRepository.findByUserIdOrderByTimestampDesc(userId, pageable);
    }

    @Transactional(rollbackFor = Exception.class)
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

    public NotificationDTO convertToDTO(Notification notification) {
        return new NotificationDTO(
                notification.getId(),
                notification.getMessage(),
                notification.getTimestamp(),
                notification.getIsRead(),
                notification.getType(),
                notification.getLink()
        );
    }

    private void markAllAsRead(List<Notification> notifications) {
        notifications.forEach(n -> n.setIsRead(true));
    }
}
