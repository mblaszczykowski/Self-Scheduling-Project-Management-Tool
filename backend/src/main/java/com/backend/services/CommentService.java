package com.backend.services;

import com.backend.daos.CommentDAO;
import com.backend.daos.UserDAO;
import com.backend.dtos.CommentDTO;
import com.backend.entities.*;
import com.backend.exception.AuthorizationException;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class CommentService {

    private final CommentDAO commentDAO;
    private final UserDAO userDAO;
    private final FileStorageService fileStorageService;
    private final NotificationService notificationService;

    public CommentService(CommentDAO commentDAO, UserDAO userDAO,
                          FileStorageService fileStorageService,
                          NotificationService notificationService) {
        this.commentDAO = commentDAO;
        this.userDAO = userDAO;
        this.fileStorageService = fileStorageService;
        this.notificationService = notificationService;
    }

    @Transactional(readOnly = true)
    public List<CommentDTO> getCommentsByTask(Integer taskId, Integer userId) {
        Task task = commentDAO.getTaskById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        verifyProjectAccess(task.getProject(), userId);

        List<Comment> topLevelComments = commentDAO.getTopLevelCommentsByTaskIdWithDetails(taskId);

        // Batch load replies to avoid N+1
        List<Integer> topLevelIds = topLevelComments.stream()
                .map(Comment::getId)
                .collect(Collectors.toList());

        Map<Integer, List<Comment>> repliesByParent = new HashMap<>();
        if (!topLevelIds.isEmpty()) {
            List<Comment> allReplies = commentDAO.getRepliesByParentIds(topLevelIds);
            repliesByParent = allReplies.stream()
                    .collect(Collectors.groupingBy(c -> c.getParentComment().getId()));
        }

        Map<Integer, List<Comment>> finalReplies = repliesByParent;
        return topLevelComments.stream()
                .sorted(Comparator.comparing(Comment::getTimestamp))
                .map(c -> convertToDTOWithReplies(c, finalReplies))
                .collect(Collectors.toList());
    }

    @Transactional
    public CommentDTO addComment(Integer taskId, Integer userId, String content,
                                 List<MultipartFile> files, Integer parentCommentId) {
        if (content == null || content.trim().isEmpty()) {
            throw new ValidationException("Comment content cannot be empty");
        }

        Task task = commentDAO.getTaskById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        verifyProjectAccess(task.getProject(), userId);

        User user = userDAO.getUserById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        List<String> attachmentUrls = (files != null && !files.isEmpty())
                ? fileStorageService.storeFiles(files)
                : new ArrayList<>();

        Comment parentComment = null;
        if (parentCommentId != null) {
            parentComment = commentDAO.getCommentById(parentCommentId)
                    .orElseThrow(() -> new ResourceNotFoundException("Parent comment not found"));
        }

        String sanitizedContent = Jsoup.clean(content, Safelist.none());

        Comment comment = new Comment(task, user, parentComment, sanitizedContent, attachmentUrls);
        Comment savedComment = commentDAO.addComment(comment);

        if (parentComment != null && !parentComment.getAuthor().getId().equals(userId)) {
            String message = "Someone replied to your comment on task: " + task.getSummary();
            String link = "/projects?selectedIssue=" + task.getTaskKey();
            notificationService.createNotification(parentComment.getAuthor(), message,
                    NotificationType.COMMENT_REPLY, link);
        }

        return convertToDTO(savedComment);
    }

    @Transactional
    public CommentDTO updateComment(Integer commentId, Integer userId, String content,
                                    List<MultipartFile> files) {
        if (content == null || content.trim().isEmpty()) {
            throw new ValidationException("Comment content cannot be empty");
        }

        Comment comment = commentDAO.getCommentByIdWithTaskAndProject(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));

        verifyProjectAccess(comment.getTask().getProject(), userId);

        if (!comment.getAuthor().getId().equals(userId)) {
            throw new AuthorizationException("User not authorized to edit this comment");
        }

        String sanitizedContent = Jsoup.clean(content, Safelist.none());
        comment.setContent(sanitizedContent);
        comment.setEditedAt(new Date());

        if (files != null && !files.isEmpty()) {
            List<String> newAttachments = fileStorageService.storeFiles(files);
            comment.getAttachments().addAll(newAttachments);
        }

        Comment updatedComment = commentDAO.updateComment(comment);
        return convertToDTO(updatedComment);
    }

    @Transactional
    public void deleteComment(Integer commentId, Integer userId) {
        Comment comment = commentDAO.getCommentByIdWithTaskAndProject(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));

        verifyProjectAccess(comment.getTask().getProject(), userId);

        if (!comment.getAuthor().getId().equals(userId)) {
            throw new AuthorizationException("User not authorized to delete this comment");
        }

        commentDAO.deleteComment(comment);
    }

    @Transactional
    public CommentDTO reactToComment(Integer commentId, Integer userId, ReactionType reactionType) {
        Comment comment = commentDAO.getCommentByIdWithTaskAndProject(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));

        verifyProjectAccess(comment.getTask().getProject(), userId);

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
            CommentReaction newReaction = new CommentReaction(comment, user, reactionType);
            commentDAO.addReaction(newReaction);
        }

        if (!comment.getAuthor().getId().equals(userId)) {
            String message = "Someone reacted to your comment on task: " + comment.getTask().getSummary();
            String link = "/projects?selectedIssue=" + comment.getTask().getTaskKey();
            notificationService.createNotification(comment.getAuthor(), message,
                    NotificationType.COMMENT_REACTION, link);
        }

        Comment refreshedComment = commentDAO.getCommentById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));
        return convertToDTO(refreshedComment);
    }

    private void verifyProjectAccess(Project project, Integer userId) {
        if (!project.hasAccess(userId)) {
            throw new AuthorizationException("Access denied to this project");
        }
    }

    private CommentDTO convertToDTOWithReplies(Comment comment, Map<Integer, List<Comment>> repliesMap) {
        List<CommentDTO> replies = repliesMap.getOrDefault(comment.getId(), Collections.emptyList())
                .stream()
                .sorted(Comparator.comparing(Comment::getTimestamp))
                .map(c -> convertToDTOWithReplies(c, repliesMap))
                .collect(Collectors.toList());

        return buildCommentDTO(comment, replies);
    }

    private CommentDTO convertToDTO(Comment comment) {
        return buildCommentDTO(comment, Collections.emptyList());
    }

    private CommentDTO buildCommentDTO(Comment comment, List<CommentDTO> replies) {
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
                likedByUsernames.size(),
                dislikedByUsernames.size(),
                likedByUsernames,
                dislikedByUsernames,
                replies
        );
    }
}