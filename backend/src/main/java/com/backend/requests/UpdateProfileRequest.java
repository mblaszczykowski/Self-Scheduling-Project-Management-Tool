package com.backend.requests;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

/**
 * Profile changes. Every field is optional: a null (omitted) value leaves that field alone, but
 * an explicit empty string is rejected by the {@code @Size} constraints below rather than
 * treated as "leave alone".
 *
 * <p>Changing the email address requires {@code currentPassword}, the same as changing the
 * password: login is by email, so an attacker holding a short-lived access token could otherwise
 * lock the real owner out permanently without ever learning their password.
 */
public record UpdateProfileRequest(
        @Size(min = 2, max = 50, message = "First name must be between 2 and 50 characters")
        String firstname,

        @Size(min = 2, max = 50, message = "Last name must be between 2 and 50 characters")
        String lastname,

        @Email(message = "Invalid email format")
        String email,

        String currentPassword,

        @Size(min = 8, max = 128, message = "Password must be between 8 and 128 characters")
        String newPassword
) {}
