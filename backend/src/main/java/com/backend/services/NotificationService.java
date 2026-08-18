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

    /** One notification to send: the recipient plus everything needed to render it. */
    public record Pending(User recipient, String message, NotificationType type, String link) {}

    @Transactional(rollbackFor = Exception.class)
    public void createNotification(User recipient, String message, NotificationType type, String link) {
        notifyAll(List.of(new Pending(recipient, message, type, link)));
    }

    /**
     * Sends a batch, at most one notification per recipient.
     *
     * <p>The de-duplication is the point: adding a project member used to fire both
     * PROJECT_INVITATION and PROJECT_UPDATED at the same person, and replying to the assignee's
     * comment on their own task fired both COMMENT_REPLY and TASK_COMMENT. Callers now hand over
     * every candidate and the first entry per recipient wins.
     */
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

            // Snapshot everything the side effects need while the entities are still managed, so
            // the async email thread never touches a detached User.
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

    /** Mapping happens inside the transaction; entities never leave the service. */
    @Transactional(readOnly = true)
    public Page<NotificationDTO> getNotifications(Integer userId, Pageable pageable) {
        return notificationRepository.findByUserIdOrderByTimestampDescIdDesc(userId, pageable)
                .map(entityMapper::toNotificationDTO);
    }

    @Transactional(readOnly = true)
    public long countUnread(Integer userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    /**
     * Flips the read flag in one statement. Ownership is checked by counting how many of the ids
     * actually belong to the caller, rather than loading every row to inspect it in Java.
     */
    @Transactional(rollbackFor = Exception.class)
    public void markNotificationsAsRead(List<Integer> notificationIds, Integer userId) {
        if (notificationIds == null || notificationIds.isEmpty()) {
            return;
        }
        var distinctIds = notificationIds.stream().filter(java.util.Objects::nonNull).distinct().toList();
        if (distinctIds.isEmpty()) {
            return;
        }
        if (notificationRepository.countOwnedBy(distinctIds, userId) != distinctIds.size()) {
            throw new AuthorizationException("Access denied to notification");
        }
        notificationRepository.markReadForUser(distinctIds, userId);
    }
}
