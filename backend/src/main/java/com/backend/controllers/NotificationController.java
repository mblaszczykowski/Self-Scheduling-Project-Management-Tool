package com.backend.controllers;

import com.backend.dtos.NotificationDTO;
import com.backend.entities.Notification;
import com.backend.services.NotificationService;
import com.backend.services.TokenService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("api/notifications")
public class NotificationController {
    private final NotificationService notificationService;
    private final TokenService tokenService;

    private static final int DEFAULT_PAGE_SIZE = 50;
    private static final int MAX_PAGE_SIZE = 100;

    public NotificationController(NotificationService notificationService, TokenService tokenService) {
        this.notificationService = notificationService;
        this.tokenService = tokenService;
    }

    @GetMapping
    public ResponseEntity<?> getNotifications(
            HttpServletRequest request,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        var userId = tokenService.getUserIdFromRequest(request);
        var clampedSize = Math.min(size, MAX_PAGE_SIZE);

        var pageable = PageRequest.of(page, clampedSize);
        var notificationPage = notificationService.getAllNotificationsPaged(userId, pageable);

        var notificationDTOs = notificationPage.getContent().stream()
                .map(this::convertToDTO)
                .toList();

        var isDefaultFirstPage = page == 0 && clampedSize == DEFAULT_PAGE_SIZE && !notificationPage.hasNext();
        if (isDefaultFirstPage) {
            return ResponseEntity.ok(notificationDTOs);
        }

        return ResponseEntity.ok(Map.of(
                "content", notificationDTOs,
                "page", notificationPage.getNumber(),
                "size", notificationPage.getSize(),
                "totalElements", notificationPage.getTotalElements(),
                "totalPages", notificationPage.getTotalPages(),
                "hasNext", notificationPage.hasNext()
        ));
    }

    @PostMapping("/mark-as-read")
    public ResponseEntity<Void> markAsRead(
            HttpServletRequest request,
            @RequestBody List<Integer> notificationIds
    ) {
        var userId = tokenService.getUserIdFromRequest(request);
        notificationService.markNotificationsAsRead(notificationIds, userId);
        return ResponseEntity.ok().build();
    }

    private NotificationDTO convertToDTO(Notification notification) {
        return new NotificationDTO(
                notification.getId(),
                notification.getMessage(),
                notification.getTimestamp() != null ? notification.getTimestamp().toInstant() : null,
                notification.getIsRead(),
                notification.getType(),
                notification.getLink()
        );
    }
}