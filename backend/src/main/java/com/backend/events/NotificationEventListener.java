package com.backend.events;

import com.backend.services.EmailService;
import com.backend.services.NotificationService;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class NotificationEventListener {

    private final NotificationService notificationService;
    private final EmailService emailService;

    public NotificationEventListener(NotificationService notificationService, EmailService emailService) {
        this.notificationService = notificationService;
        this.emailService = emailService;
    }

    @EventListener
    public void handleNotification(NotificationEvent event) {
        notificationService.createNotification(event.recipient(), event.message(), event.type(), event.link());
    }

    @EventListener
    public void handleInvitationEmail(InvitationEmailEvent event) {
        emailService.sendInvitationEmail(event.recipientEmail(), event.projectName(), event.inviterName());
    }
}
