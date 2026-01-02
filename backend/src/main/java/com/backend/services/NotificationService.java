package com.backend.services;

import com.backend.daos.NotificationDAO;
import com.backend.entities.Notification;
import com.backend.entities.NotificationType;
import com.backend.entities.User;
import com.backend.exception.AuthorizationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;

@Service
public class NotificationService {
    private final NotificationDAO notificationDAO;

    public NotificationService(NotificationDAO notificationDAO) {
        this.notificationDAO = notificationDAO;
    }

    public void createNotification(User recipient, String message, NotificationType type, String link) {
        Notification notification = new Notification();
        notification.setUser(recipient);
        notification.setMessage(message);
        notification.setType(type);
        notification.setTimestamp(new Date());
        notification.setLink(link);
        notificationDAO.saveNotification(notification);
    }

    public List<Notification> getAllNotifications(Integer userId) {
        return notificationDAO.getAllNotificationsByUserId(userId);
    }

    @Transactional
    public void markNotificationsAsRead(List<Integer> notificationIds, Integer userId) {
        List<Notification> notifications = notificationDAO.findAllById(notificationIds);

        // Verify ownership of all notifications
        for (Notification notification : notifications) {
            if (!notification.getUser().getId().equals(userId)) {
                throw new AuthorizationException("Access denied to notification");
            }
        }

        for (Notification notification : notifications) {
            notification.setIsRead(true);
        }
        notificationDAO.saveAll(notifications);
    }
}