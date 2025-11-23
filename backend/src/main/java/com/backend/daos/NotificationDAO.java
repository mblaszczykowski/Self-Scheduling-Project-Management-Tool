package com.backend.daos;

import com.backend.entities.Notification;
import com.backend.repositories.NotificationRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class NotificationDAO {
    private final NotificationRepository notificationRepository;

    public NotificationDAO(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    public void saveNotification(Notification notification) {
        notificationRepository.save(notification);
    }

    public List<Notification> getUnreadNotificationsByUserId(Integer userId) {
        return notificationRepository.findByUserIdAndIsReadFalseOrderByTimestampDesc(userId);
    }

    public List<Notification> getAllNotificationsByUserId(Integer userId) {
        return notificationRepository.findByUserIdOrderByTimestampDesc(userId);
    }

    public List<Notification> findAllById(List<Integer> ids) {
        return notificationRepository.findAllById(ids);
    }

    public void saveAll(List<Notification> notifications) {
        notificationRepository.saveAll(notifications);
    }
}
