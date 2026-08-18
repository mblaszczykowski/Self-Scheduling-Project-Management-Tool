package com.backend.dtos;

/**
 * A user as seen by other people: project members, comment authors, assignees.
 *
 * <p>Deliberately excludes the email-notification preferences — those are the owner's settings
 * and are exposed only through {@link CurrentUserDTO}, to the owner themselves.
 */
public record UserDTO(
        Integer id,
        String firstname,
        String lastname,
        String email,
        String profilePicture
) {}
