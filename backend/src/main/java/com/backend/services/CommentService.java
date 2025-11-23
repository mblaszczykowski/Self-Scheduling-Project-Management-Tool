package com.backend.services;

import com.backend.daos.CommentDAO;
import com.backend.daos.UserDAO;
import com.backend.dtos.CommentDTO;
import com.backend.dtos.ReactionsDTO;
import com.backend.entities.*;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class CommentService {

    private final CommentDAO commentDAO;
    private final UserDAO userDAO;
    private final FileStorageService fileStorageService;
    private final NotificationService notificationService;

    public CommentService(CommentDAO commentDAO, UserDAO userDAO, FileStorageService fileStorageService, NotificationService notificationService) {
        this.commentDAO = commentDAO;
        this.userDAO = userDAO;
        this.fileStorageService = fileStorageService;
        this.notificationService = notificationService;
    }

    public List<CommentDTO> getCommentsByTask(Integer taskId) {
        List<Comment> topLevelComments = commentDAO.getTopLevelCommentsByTaskId(taskId);

        return topLevelComments.stream()
                .sorted(Comparator.comparing(Comment::getTimestamp))
                .map(this::convertToDTOWithReplies)
                .collect(Collectors.toList());
    }

    public CommentDTO addComment(Integer taskId, Integer userId, String content, List<MultipartFile> files, Integer parentCommentId) {
        if (content == null || content.trim().isEmpty()) {
            throw new ValidationException("Comment content cannot be empty");
        }

        Task task = commentDAO.getTaskById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        User user = userDAO.getUserById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        List<String> attachmentUrls = (files != null && !files.isEmpty()) ? fileStorageService.storeFiles(files) : new ArrayList<>();

        Comment parentComment = null;
        if (parentCommentId != null) {
            parentComment = commentDAO.getCommentById(parentCommentId)
                    .orElseThrow(() -> new ResourceNotFoundException("Parent comment not found"));
        }

        String sanitizedContent = Jsoup.clean(content, Safelist.none());

        Comment comment = new Comment(task, user, parentComment, sanitizedContent, attachmentUrls);
        Comment savedComment = commentDAO.addComment(comment);

        // Send notification if it's a reply
        if (parentComment != null && !parentComment.getAuthor().getId().equals(userId)) {
            String message = "Someone replied to your comment on task: " + task.getSummary();
            String link = "/timeline?selectedIssue=" + task.getProject().getProjectKey() + "-" + task.getId();
            notificationService.createNotification(parentComment.getAuthor(), message, NotificationType.COMMENT_REPLY, link);
        }

        return convertToDTOWithReplies(savedComment);
    }

    public CommentDTO updateComment(Integer commentId, Integer userId, String content, List<MultipartFile> files) {
        if (content == null || content.trim().isEmpty()) {
            throw new ValidationException("Comment content cannot be empty");
        }

        Comment comment = commentDAO.getCommentById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));

        if (!comment.getAuthor().getId().equals(userId)) {
            throw new ValidationException("User not authorized to edit this comment");
        }

        String sanitizedContent = Jsoup.clean(content, Safelist.none());

        comment.setContent(sanitizedContent);
        comment.setEditedAt(new Date());

        if (files != null && !files.isEmpty()) {
            List<String> newAttachments = fileStorageService.storeFiles(files);
            comment.getAttachments().addAll(newAttachments);
        }

        Comment updatedComment = commentDAO.updateComment(comment);
        return convertToDTOWithReplies(updatedComment);
    }

    public void deleteComment(Integer commentId, Integer userId) {
        Comment comment = commentDAO.getCommentById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));

        if (!comment.getAuthor().getId().equals(userId)) {
            throw new ValidationException("User not authorized to delete this comment");
        }

        commentDAO.deleteComment(comment);
    }

    public CommentDTO reactToComment(Integer commentId, Integer userId, ReactionType reactionType) {
        Comment comment = commentDAO.getCommentById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));

        User user = userDAO.getUserById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Optional<CommentReaction> existingReactionOpt = commentDAO.findReaction(commentId, userId);

        if (existingReactionOpt.isPresent()) {
            CommentReaction existingReaction = existingReactionOpt.get();
            if (existingReaction.getType() == reactionType) {
                commentDAO.removeReaction(existingReaction);
            } else {
                existingReaction.setType(reactionType);
                commentDAO.updateReaction(existingReaction);
            }
        } else {
            // Add new reaction
            CommentReaction newReaction = new CommentReaction(comment, user, reactionType);
            commentDAO.addReaction(newReaction);
        }

        if (!comment.getAuthor().getId().equals(userId)) {
            String message = "Someone reacted to your comment on task: " + comment.getTask().getSummary();
            String link = "/timeline?selectedIssue=" + comment.getTask().getProject().getProjectKey() + "-" + comment.getTask().getId();
            notificationService.createNotification(comment.getAuthor(), message, NotificationType.COMMENT_REACTION, link);
        }

        return convertToDTOWithReplies(comment);
    }

    private CommentDTO convertToDTOWithReplies(Comment comment) {
        List<CommentDTO> replies = Optional.ofNullable(comment.getReplies())
                .orElse(Collections.emptyList())
                .stream()
                .sorted(Comparator.comparing(Comment::getTimestamp))
                .map(this::convertToDTOWithReplies)
                .collect(Collectors.toList());

        List<String> likedByUsernames = Optional.ofNullable(comment.getReactions())
                .orElse(Collections.emptyList())
                .stream()
                .filter(r -> r.getType() == ReactionType.LIKE)
                .map(r -> r.getUser() != null ? r.getUser().getFullName() : null)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        List<String> dislikedByUsernames = Optional.ofNullable(comment.getReactions())
                .orElse(Collections.emptyList())
                .stream()
                .filter(r -> r.getType() == ReactionType.DISLIKE)
                .map(r -> r.getUser() != null ? r.getUser().getFullName() : null)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        int likeCount = likedByUsernames.size();
        int dislikeCount = dislikedByUsernames.size();

        return new CommentDTO(
                comment.getId(),
                comment.getTask() != null ? comment.getTask().getId() : null,
                comment.getAuthor() != null ? comment.getAuthor().getId() : null,
                comment.getAuthor() != null ? comment.getAuthor().getFullName() : null,
                comment.getAuthor() != null ? comment.getAuthor().getProfilePicture() : null,
                comment.getContent(),
                comment.getTimestamp(),
                comment.getEditedAt(),
                Optional.ofNullable(comment.getAttachments()).orElse(Collections.emptyList()),
                likeCount,
                dislikeCount,
                likedByUsernames,
                dislikedByUsernames,
                replies
        );
    }

    public ReactionsDTO getReactionsForComment(Integer commentId) {
        Comment comment = commentDAO.getCommentById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));

        List<String> likedByUsernames = comment.getReactions().stream()
                .filter(r -> r.getType() == ReactionType.LIKE)
                .map(r -> r.getUser().getFullName())
                .collect(Collectors.toList());

        List<String> dislikedByUsernames = comment.getReactions().stream()
                .filter(r -> r.getType() == ReactionType.DISLIKE)
                .map(r -> r.getUser().getFullName())
                .collect(Collectors.toList());

        return new ReactionsDTO(likedByUsernames, dislikedByUsernames);
    }
}
