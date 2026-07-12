package com.backend.controllers;

import com.backend.config.AppProperties;
import com.backend.dtos.NotificationDTO;
import com.backend.dtos.PagedResponse;
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

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final NotificationService notificationService;
    private final SseEmitterManager sseEmitterManager;
    private final TokenService tokenService;
    private final AppProperties appProperties;

    public NotificationController(NotificationService notificationService,
                                  SseEmitterManager sseEmitterManager,
                                  TokenService tokenService,
                                  AppProperties appProperties) {
        this.notificationService = notificationService;
        this.sseEmitterManager = sseEmitterManager;
        this.tokenService = tokenService;
        this.appProperties = appProperties;
    }

    @GetMapping
    public ResponseEntity<PagedResponse<NotificationDTO>> getNotifications(
            HttpServletRequest request,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        var userId = tokenService.getUserIdFromRequest(request);
        var clampedSize = Math.min(size, appProperties.getPagination().getMaxSize());

        var pageable = PageRequest.of(page, clampedSize);
        var dtoPage = notificationService.getAllNotificationsPaged(userId, pageable)
                .map(notificationService::convertToDTO);

        return ResponseEntity.ok(PagedResponse.of(dtoPage));
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