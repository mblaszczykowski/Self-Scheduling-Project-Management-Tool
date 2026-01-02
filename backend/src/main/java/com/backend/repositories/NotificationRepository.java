package com.backend.repositories;

import com.backend.entities.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Integer> {
    List<Notification> findByUserIdAndIsReadFalseOrderByTimestampDesc(Integer userId);
    List<Notification> findByUserIdOrderByTimestampDesc(Integer userId);
}