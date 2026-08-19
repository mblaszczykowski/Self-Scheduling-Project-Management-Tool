package com.backend.controllers;

import com.backend.dtos.CommentDTO;
import com.backend.dtos.PagedResponse;
import com.backend.entities.ReactionType;
import com.backend.services.CommentService;
import com.backend.util.ValidationUtil;
import com.backend.web.CurrentUserId;
import com.backend.web.PageRequests;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@Validated
@RequestMapping("/api/tasks/{taskId}/comments")
public class CommentController {

    private final CommentService commentService;
    private final PageRequests pageRequests;

    public CommentController(CommentService commentService, PageRequests pageRequests) {
        this.commentService = commentService;
        this.pageRequests = pageRequests;
    }

    @GetMapping
    public ResponseEntity<PagedResponse<CommentDTO>> getComments(
            @CurrentUserId Integer userId,
            @PathVariable Integer taskId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size
    ) {
        var pageable = pageRequests.of(page, size);
        return ResponseEntity.ok(PagedResponse.of(
                commentService.getCommentsByTask(taskId, userId, pageable)));
    }

    @PostMapping(consumes = {"multipart/form-data"})
    public ResponseEntity<CommentDTO> addComment(
            @CurrentUserId Integer userId,
            @PathVariable Integer taskId,
            @RequestPart("content")
            @NotBlank(message = "Comment content cannot be empty")
            @Size(max = ValidationUtil.MAX_COMMENT_LENGTH,
                    message = "Comment exceeds the maximum length of "
                            + ValidationUtil.MAX_COMMENT_LENGTH + " characters") String content,
            @RequestPart(value = "attachments", required = false) List<MultipartFile> attachments,
            @RequestParam(value = "parentCommentId", required = false) Integer parentCommentId
    ) {
        var created = commentService.addComment(taskId, userId, content, attachments, parentCommentId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping(value = "/{commentId}", consumes = {"multipart/form-data"})
    public ResponseEntity<CommentDTO> updateComment(
            @CurrentUserId Integer userId,
            @PathVariable Integer taskId,
            @PathVariable Integer commentId,
            @RequestPart("content")
            @NotBlank(message = "Comment content cannot be empty")
            @Size(max = ValidationUtil.MAX_COMMENT_LENGTH,
                    message = "Comment exceeds the maximum length of "
                            + ValidationUtil.MAX_COMMENT_LENGTH + " characters") String content,
            @RequestPart(value = "attachments", required = false) List<MultipartFile> attachments
    ) {
        return ResponseEntity.ok(
                commentService.updateComment(taskId, commentId, userId, content, attachments));
    }

    @DeleteMapping("/{commentId}")
    public ResponseEntity<Void> deleteComment(@CurrentUserId Integer userId,
                                              @PathVariable Integer taskId,
                                              @PathVariable Integer commentId) {
        commentService.deleteComment(taskId, commentId, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{commentId}/reactions")
    public ResponseEntity<CommentDTO> reactToComment(@CurrentUserId Integer userId,
                                                     @PathVariable Integer taskId,
                                                     @PathVariable Integer commentId,
                                                     @RequestParam("type") ReactionType reactionType) {
        return ResponseEntity.ok(
                commentService.reactToComment(taskId, commentId, userId, reactionType));
    }
}
