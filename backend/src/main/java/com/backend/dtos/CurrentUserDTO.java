package com.backend.dtos;

/** The signed-in user's own profile, including the settings only they may see. */
public record CurrentUserDTO(
        Integer id,
        String firstname,
        String lastname,
        String email,
        String profilePicture,
        Boolean emailNotificationsEnabled,
        Boolean emailOnTaskAssigned,
        Boolean emailOnCommentReply,
        Boolean emailOnProjectInvitation
) {}
