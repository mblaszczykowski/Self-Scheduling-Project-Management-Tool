package com.backend.controllers;

import com.backend.services.NotificationService;
import com.backend.services.SseEmitterManager;
import com.backend.services.TokenService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final NotificationService notificationService;
    private final SseEmitterManager sseEmitterManager;
    private final TokenService tokenService;

    private static final int DEFAULT_PAGE_SIZE = 50;
    private static final int MAX_PAGE_SIZE = 100;

    public NotificationController(NotificationService notificationService,
                                  SseEmitterManager sseEmitterManager,
                                  TokenService tokenService) {
        this.notificationService = notificationService;
        this.sseEmitterManager = sseEmitterManager;
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
                .map(notificationService::convertToDTO)
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

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamNotifications(HttpServletRequest request) {
        var userId = tokenService.getUserIdFromRequest(request);
        return sseEmitterManager.createEmitter(userId);
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

}