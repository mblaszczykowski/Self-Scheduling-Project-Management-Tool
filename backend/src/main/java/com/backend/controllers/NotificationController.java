package com.backend.controllers;

import com.backend.dtos.NotificationDTO;
import com.backend.dtos.PagedResponse;
import com.backend.services.NotificationService;
import com.backend.services.SseEmitterManager;
import com.backend.web.CurrentUserId;
import com.backend.web.PageRequests;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@Validated
public class NotificationController {
    private final NotificationService notificationService;
    private final SseEmitterManager sseEmitterManager;
    private final PageRequests pageRequests;

    public NotificationController(NotificationService notificationService,
                                  SseEmitterManager sseEmitterManager,
                                  PageRequests pageRequests) {
        this.notificationService = notificationService;
        this.sseEmitterManager = sseEmitterManager;
        this.pageRequests = pageRequests;
    }

    @GetMapping
    public ResponseEntity<PagedResponse<NotificationDTO>> getNotifications(
            @CurrentUserId Integer userId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size
    ) {
        var pageable = pageRequests.of(page, size);
        return ResponseEntity.ok(PagedResponse.of(notificationService.getNotifications(userId, pageable)));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<UnreadCount> getUnreadCount(@CurrentUserId Integer userId) {
        return ResponseEntity.ok(new UnreadCount(notificationService.countUnread(userId)));
    }

    public record UnreadCount(long count) {}

    @ApiResponse(responseCode = "200", description = "Stream of notification events",
            content = @Content(mediaType = MediaType.TEXT_EVENT_STREAM_VALUE,
                    schema = @Schema(implementation = NotificationDTO.class)))
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamNotifications(@CurrentUserId Integer userId) {
        return sseEmitterManager.createEmitter(userId);
    }

    @PostMapping("/mark-as-read")
    public ResponseEntity<Void> markAsRead(
            @CurrentUserId Integer userId,
            @RequestBody @NotEmpty @Size(max = 500, message = "At most 500 notifications at a time")
            List<Integer> notificationIds
    ) {
        notificationService.markNotificationsAsRead(notificationIds, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/mark-all-read")
    public ResponseEntity<UnreadCount> markAllRead(@CurrentUserId Integer userId) {
        return ResponseEntity.ok(new UnreadCount(notificationService.markAllNotificationsAsRead(userId)));
    }
}
