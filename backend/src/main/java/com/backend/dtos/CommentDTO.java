package com.backend.dtos;

import java.util.Date;
import java.util.List;

public record CommentDTO(
        Integer id,
        Integer taskId,
        Integer authorId,
        String authorName,
        String authorProfilePicture,
        String content,
        Date timestamp,
        Date editedAt,
        List<String> attachments,
        Integer likeCount,
        Integer dislikeCount,
        List<String> likedByUsernames,
        List<String> dislikedByUsernames,
        List<CommentDTO> replies
) {}
