package com.backend.requests;

public record EmailPreferencesRequest(
        Boolean emailNotificationsEnabled,
        Boolean emailOnTaskAssigned,
        Boolean emailOnCommentReply,
        Boolean emailOnProjectInvitation
) {
}
