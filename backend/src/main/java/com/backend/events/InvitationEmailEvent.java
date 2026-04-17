package com.backend.events;

public record InvitationEmailEvent(
        String recipientEmail,
        String projectName,
        String inviterName
) {}
