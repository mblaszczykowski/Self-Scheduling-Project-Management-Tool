package com.backend.requests;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @Size(min = 2, max = 50, message = "First name must be between 2 and 50 characters")
        String firstname,

        @Size(min = 2, max = 50, message = "Last name must be between 2 and 50 characters")
        String lastname,

        @Email(message = "Invalid email format")
        String email,

        @Size(max = 72, message = "Current password must not exceed 72 characters")
        String currentPassword,

        @Size(min = 8, max = 72, message = "Password must be between 8 and 72 characters")
        String newPassword
) {}
