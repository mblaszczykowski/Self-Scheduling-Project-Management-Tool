package com.backend.controllers;

import com.backend.dtos.NotificationDTO;
import com.backend.entities.Notification;
import com.backend.services.NotificationService;
import com.backend.services.TokenService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("api/notifications")
public class NotificationController {
    private final NotificationService notificationService;
    private final TokenService tokenService;

    public NotificationController(NotificationService notificationService, TokenService tokenService) {
        this.notificationService = notificationService;
        this.tokenService = tokenService;
    }

    @GetMapping
    public ResponseEntity<List<NotificationDTO>> getNotifications(HttpServletRequest request) {
        Integer userId = tokenService.getUserIdFromRequest(request);
        List<Notification> notifications = notificationService.getAllNotifications(userId);

        List<NotificationDTO> notificationDTOs = notifications.stream()
                .map(notification -> new NotificationDTO(
                        notification.getId(),
                        notification.getMessage(),
                        notification.getTimestamp(),
                        notification.getIsRead(),
                        notification.getType(),
                        notification.getLink()
                ))
                .collect(Collectors.toList());

        return ResponseEntity.ok(notificationDTOs);
    }

    @PostMapping("/mark-as-read")
    public ResponseEntity<Void> markAsRead(@RequestBody List<Integer> notificationIds) {
        notificationService.markNotificationsAsRead(notificationIds);
        return ResponseEntity.ok().build();
    }
}
