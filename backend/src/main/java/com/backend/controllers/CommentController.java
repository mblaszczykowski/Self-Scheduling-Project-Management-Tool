package com.backend.controllers;

import com.backend.dtos.CommentDTO;
import com.backend.entities.ReactionType;
import com.backend.services.CommentService;
import com.backend.services.TokenService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/tasks/{taskId}/comments")
public class CommentController {

    private final CommentService commentService;
    private final TokenService tokenService;

    public CommentController(CommentService commentService, TokenService tokenService) {
        this.commentService = commentService;
        this.tokenService = tokenService;
    }

    @GetMapping
    public ResponseEntity<List<CommentDTO>> getComments(
            HttpServletRequest request,
            @PathVariable Integer taskId
    ) {
        var userId = tokenService.getUserIdFromRequest(request);
        var comments = commentService.getCommentsByTask(taskId, userId);
        return ResponseEntity.ok(comments);
    }

    @PostMapping(consumes = {"multipart/form-data"})
    public ResponseEntity<CommentDTO> addComment(
            HttpServletRequest request,
            @PathVariable Integer taskId,
            @RequestPart("content") String content,
            @RequestPart(value = "attachments", required = false) List<MultipartFile> attachments,
            @RequestParam(value = "parentCommentId", required = false) Integer parentCommentId
    ) {
        var userId = tokenService.getUserIdFromRequest(request);
        var createdComment = commentService.addComment(taskId, userId, content,
                attachments, parentCommentId);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdComment);
    }

    @PutMapping(value = "/{commentId}", consumes = {"multipart/form-data"})
    public ResponseEntity<CommentDTO> updateComment(
            HttpServletRequest request,
            @PathVariable Integer taskId,
            @PathVariable Integer commentId,
            @RequestPart("content") String content,
            @RequestPart(value = "attachments", required = false) List<MultipartFile> attachments
    ) {
        var userId = tokenService.getUserIdFromRequest(request);
        commentService.verifyCommentBelongsToTask(commentId, taskId);
        var updatedComment = commentService.updateComment(commentId, userId, content, attachments);
        return ResponseEntity.ok(updatedComment);
    }

    @DeleteMapping("/{commentId}")
    public ResponseEntity<Void> deleteComment(
            HttpServletRequest request,
            @PathVariable Integer taskId,
            @PathVariable Integer commentId
    ) {
        var userId = tokenService.getUserIdFromRequest(request);
        commentService.verifyCommentBelongsToTask(commentId, taskId);
        commentService.deleteComment(commentId, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{commentId}/react")
    public ResponseEntity<CommentDTO> reactToComment(
            HttpServletRequest request,
            @PathVariable Integer taskId,
            @PathVariable Integer commentId,
            @RequestParam("type") ReactionType reactionType
    ) {
        var userId = tokenService.getUserIdFromRequest(request);
        commentService.verifyCommentBelongsToTask(commentId, taskId);
        var updatedComment = commentService.reactToComment(commentId, userId, reactionType);
        return ResponseEntity.ok(updatedComment);
    }
}