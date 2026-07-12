package com.backend.services;

import com.backend.dtos.NotificationDTO;
import com.backend.entities.Notification;
import com.backend.entities.NotificationType;
import com.backend.entities.User;
import com.backend.exception.AuthorizationException;
import com.backend.repositories.NotificationRepository;
import com.backend.util.EntityMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.List;

@Service
public class NotificationService {
    private final NotificationRepository notificationRepository;
    private final SseEmitterManager sseEmitterManager;
    private final EmailService emailService;
    private final EntityMapper entityMapper;

    public NotificationService(NotificationRepository notificationRepository,
                               SseEmitterManager sseEmitterManager,
                               EmailService emailService,
                               EntityMapper entityMapper) {
        this.notificationRepository = notificationRepository;
        this.sseEmitterManager = sseEmitterManager;
        this.emailService = emailService;
        this.entityMapper = entityMapper;
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

        // Snapshot everything needed for the side effects while the entities are still managed,
        // then fire SSE + email only AFTER the surrounding transaction commits. This prevents
        // real-time pushes / emails for actions that ultimately roll back, and avoids touching
        // a detached User from the async email thread.
        var dto = entityMapper.toNotificationDTO(notification);
        Integer recipientId = recipient.getId();
        boolean wantsEmail = recipient.wantsEmailFor(type);
        String recipientEmail = recipient.getEmail();
        String recipientFirstName = recipient.getFirstname();

        runAfterCommit(() -> {
            sseEmitterManager.sendNotification(recipientId, dto);
            if (wantsEmail) {
                emailService.sendNotificationEmail(recipientEmail, recipientFirstName, message, type, link);
            }
        });
    }

    /** Runs the action after the current transaction commits, or immediately if none is active. */
    private void runAfterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
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
        return entityMapper.toNotificationDTO(notification);
    }

    private void markAllAsRead(List<Notification> notifications) {
        notifications.forEach(n -> n.setIsRead(true));
    }
}
