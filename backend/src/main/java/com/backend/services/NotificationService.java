package com.backend.services;

import com.backend.dtos.NotificationDTO;
import com.backend.entities.Notification;
import com.backend.entities.NotificationType;
import com.backend.entities.User;
import com.backend.exception.AuthorizationException;
import com.backend.mapper.EntityMapper;
import com.backend.repositories.NotificationRepository;
import com.backend.util.AfterCommit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Objects;

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

    public record Pending(User recipient, String message, NotificationType type, String link) {}

    public static String projectLink(String projectKey) {
        return "/projects?projectKey=" + projectKey;
    }

    public static String taskLink(String taskKey) {
        return "/projects?selectedIssue=" + taskKey;
    }

    public static String taskCommentLink(String taskKey, Integer commentId) {
        return "/projects?selectedIssue=" + taskKey + "&commentId=" + commentId;
    }

    @Transactional(rollbackFor = Exception.class)
    public void createNotification(User recipient, String message, NotificationType type, String link) {
        notifyAll(List.of(new Pending(recipient, message, type, link)));
    }

    @Transactional(rollbackFor = Exception.class)
    public void notifyAll(Collection<Pending> pending) {
        if (pending == null || pending.isEmpty()) {
            return;
        }

        var byRecipient = new LinkedHashMap<Integer, Pending>();
        for (var candidate : pending) {
            if (candidate == null || candidate.recipient() == null || candidate.recipient().getId() == null) {
                continue;
            }
            byRecipient.putIfAbsent(candidate.recipient().getId(), candidate);
        }

        var sideEffects = new ArrayList<Runnable>(byRecipient.size());
        for (var entry : byRecipient.values()) {
            var recipient = entry.recipient();

            var notification = new Notification();
            notification.setUser(recipient);
            notification.setMessage(entry.message());
            notification.setType(entry.type());
            notification.setTimestamp(Instant.now());
            notification.setLink(entry.link());
            notificationRepository.save(notification);

            var dto = entityMapper.toNotificationDTO(notification);
            var recipientId = recipient.getId();
            var recipientEmail = recipient.getEmail();
            var recipientFirstName = recipient.getFirstname();
            var wantsEmail = recipient.wantsEmailFor(entry.type());
            var message = entry.message();
            var type = entry.type();
            var link = entry.link();

            sideEffects.add(() -> {
                sseEmitterManager.sendNotification(recipientId, dto);
                if (wantsEmail) {
                    emailService.sendNotificationEmail(recipientEmail, recipientFirstName, message, type, link);
                }
            });
        }

        sideEffects.forEach(action -> AfterCommit.run("notification side effect", action));
    }

    @Transactional(readOnly = true)
    public Page<NotificationDTO> getNotifications(Integer userId, Pageable pageable) {
        return notificationRepository.findByUserIdOrderByTimestampDescIdDesc(userId, pageable)
                .map(entityMapper::toNotificationDTO);
    }

    @Transactional(readOnly = true)
    public long countUnread(Integer userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void markNotificationsAsRead(List<Integer> notificationIds, Integer userId) {
        if (notificationIds == null || notificationIds.isEmpty()) {
            return;
        }
        var distinctIds = notificationIds.stream().filter(Objects::nonNull).distinct().toList();
        if (distinctIds.isEmpty()) {
            return;
        }
        if (notificationRepository.countOwnedBy(distinctIds, userId) != distinctIds.size()) {
            throw new AuthorizationException("Access denied to notification");
        }
        notificationRepository.markReadForUser(distinctIds, userId);
    }

    @Transactional(rollbackFor = Exception.class)
    public long markAllNotificationsAsRead(Integer userId) {
        notificationRepository.markAllReadForUser(userId);
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }
}
