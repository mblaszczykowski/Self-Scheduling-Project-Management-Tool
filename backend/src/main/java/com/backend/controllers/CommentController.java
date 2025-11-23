package com.backend.controllers;

import com.backend.dtos.CommentDTO;
import com.backend.dtos.ReactionsDTO;
import com.backend.entities.ReactionType;
import com.backend.services.CommentService;
import com.backend.services.TokenService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("api/tasks/{taskId}/comments")
public class CommentController {

    private final CommentService commentService;
    private final TokenService tokenService;

    public CommentController(CommentService commentService, TokenService tokenService) {
        this.commentService = commentService;
        this.tokenService = tokenService;
    }

    @GetMapping
    public ResponseEntity<List<CommentDTO>> getComments(
            @PathVariable Integer taskId
    ) {
        List<CommentDTO> comments = commentService.getCommentsByTask(taskId);
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
        Integer userId = tokenService.getUserIdFromRequest(request);
        CommentDTO createdComment = commentService.addComment(taskId, userId, content, attachments, parentCommentId);
        return ResponseEntity.ok(createdComment);
    }

    @PutMapping(value = "/{commentId}", consumes = {"multipart/form-data"})
    public ResponseEntity<CommentDTO> updateComment(
            HttpServletRequest request,
            @PathVariable Integer commentId,
            @RequestPart("content") String content,
            @RequestPart(value = "attachments", required = false) List<MultipartFile> attachments
    ) {
        Integer userId = tokenService.getUserIdFromRequest(request);
        CommentDTO updatedComment = commentService.updateComment(commentId, userId, content, attachments);
        return ResponseEntity.ok(updatedComment);
    }

    @DeleteMapping("/{commentId}")
    public ResponseEntity<Void> deleteComment(
            HttpServletRequest request,
            @PathVariable Integer commentId
    ) {
        Integer userId = tokenService.getUserIdFromRequest(request);
        commentService.deleteComment(commentId, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{commentId}/react")
    public ResponseEntity<CommentDTO> reactToComment(
            HttpServletRequest request,
            @PathVariable Integer commentId,
            @RequestParam("type") ReactionType reactionType
    ) {
        Integer userId = tokenService.getUserIdFromRequest(request);
        CommentDTO updatedComment = commentService.reactToComment(commentId, userId, reactionType);
        return ResponseEntity.ok(updatedComment);
    }

    @GetMapping("/{commentId}/reactions")
    public ResponseEntity<ReactionsDTO> getReactions(
            @PathVariable Integer commentId
    ) {
        ReactionsDTO reactions = commentService.getReactionsForComment(commentId);
        return ResponseEntity.ok(reactions);
    }
}
