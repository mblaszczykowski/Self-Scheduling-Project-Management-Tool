package com.backend.requests;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Full representation of a project, as sent by {@code POST} and {@code PUT}.
 *
 * <p>{@code PUT} replaces: a collection that is present is the new complete contents, and an
 * absent (null) collection leaves that aspect untouched. Members are identified by email rather
 * than by embedding a response DTO — callers used to have to send nine-field user objects of
 * which exactly one field was read.
 */
public record ProjectRequest(
        @NotBlank(message = "Project key is required")
        @Size(max = 10, message = "Project key must not exceed 10 characters")
        @Pattern(regexp = "^[A-Z][A-Z0-9]*$",
                message = "Project key must start with a letter and contain only uppercase letters and numbers")
        String projectKey,

        @NotBlank(message = "Summary is required")
        @Size(max = 200, message = "Summary must not exceed 200 characters")
        String summary,

        @Size(max = 5000, message = "Description must not exceed 5000 characters")
        String description,

        // Capped: every unregistered address here triggers an invitation email, so an uncapped
        // list is an outbound mail amplifier.
        @Size(max = 50, message = "A project cannot have more than 50 members")
        List<@Email(message = "Invalid member email") @NotBlank String> memberEmails,

        @Size(max = 50, message = "A project cannot depend on more than 50 projects")
        List<@NotBlank String> dependencies,

        @Size(max = 50, message = "A project cannot have more than 50 attachments")
        List<@NotBlank String> attachments
) {}
