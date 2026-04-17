package com.backend.requests;

import jakarta.validation.constraints.*;

public record CommentCreateRequest(
        @NotBlank(message = "Comment content cannot be empty")
        @Size(max = 10000, message = "Comment exceeds maximum length")
        String content,

        Integer parentCommentId
) {}
