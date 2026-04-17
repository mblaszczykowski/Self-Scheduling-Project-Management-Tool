package com.backend.dtos;

public record UserDTO(
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
