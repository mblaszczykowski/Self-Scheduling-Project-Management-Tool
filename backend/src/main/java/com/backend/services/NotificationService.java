package com.backend.services;

import com.backend.daos.NotificationDAO;
import com.backend.entities.Notification;
import com.backend.entities.NotificationType;
import com.backend.entities.User;
import org.springframework.stereotype.Service;

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

    public void markNotificationsAsRead(List<Integer> notificationIds) {
        List<Notification> notifications = notificationDAO.findAllById(notificationIds);
        for (Notification notification : notifications) {
            notification.setIsRead(true);
        }
        notificationDAO.saveAll(notifications);
    }
}
