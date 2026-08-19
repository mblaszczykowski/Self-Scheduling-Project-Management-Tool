package com.backend.dtos;

import java.time.Instant;
import java.util.List;

public record CommentDTO(
        Integer id,
        Integer taskId,
        Integer authorId,
        String authorName,
        String authorProfilePicture,
        String content,
        Instant timestamp,
        Instant editedAt,
        List<String> attachments,
        Integer likeCount,
        Integer dislikeCount,
        boolean likedByCurrentUser,
        boolean dislikedByCurrentUser,
        List<CommentDTO> replies
) {}
