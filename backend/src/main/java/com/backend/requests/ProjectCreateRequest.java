package com.backend.requests;

import com.backend.dtos.UserDTO;
import jakarta.validation.constraints.*;

import java.util.List;

public record ProjectCreateRequest(
        @NotBlank(message = "Project key is required")
        @Size(max = 10, message = "Project key must not exceed 10 characters")
        @Pattern(regexp = "^[A-Z][A-Z0-9]*$", message = "Project key must start with a letter and contain only uppercase letters and numbers")
        String projectKey,

        @NotBlank(message = "Summary is required")
        @Size(max = 200, message = "Summary must not exceed 200 characters")
        String summary,

        @Size(max = 5000, message = "Description must not exceed 5000 characters")
        String description,

        List<UserDTO> members,
        List<String> dependencies,
        List<String> attachments
) {}
