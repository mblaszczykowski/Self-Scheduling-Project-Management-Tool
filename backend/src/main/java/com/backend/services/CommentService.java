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

    private static final int MAX_COMMENT_LENGTH = 2000;

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
        var task = commentDAO.getTaskById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        verifyProjectAccess(task.getProject(), userId);

        var topLevelComments = commentDAO.getTopLevelCommentsByTaskIdWithDetails(taskId);
        var repliesByParentId = batchLoadReplies(topLevelComments);
        return topLevelComments.stream()
                .sorted(Comparator.comparing(Comment::getTimestamp))
                .map(c -> convertToDTOWithReplies(c, repliesByParentId))
                .toList();
    }

    @Transactional
    public CommentDTO addComment(Integer taskId, Integer userId, String content,
                                 List<MultipartFile> files, Integer parentCommentId) {
        validateCommentContent(content);

        var task = commentDAO.getTaskById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        verifyProjectAccess(task.getProject(), userId);

        var user = userDAO.getUserById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        var attachmentUrls = (files != null && !files.isEmpty())
                ? fileStorageService.storeFiles(files)
                : new ArrayList<String>();

        Comment parentComment = null;
        if (parentCommentId != null) {
            parentComment = commentDAO.getCommentById(parentCommentId)
                    .orElseThrow(() -> new ResourceNotFoundException("Parent comment not found"));
        }

        var sanitizedContent = Jsoup.clean(content, Safelist.none());

        var comment = new Comment(task, user, parentComment, sanitizedContent, attachmentUrls);
        var savedComment = commentDAO.addComment(comment);
        initializeLazyCollections(savedComment);
        notifyParentCommentAuthorIfDifferentUser(parentComment, userId, task);
        return convertToDTO(savedComment);
    }

    @Transactional
    public CommentDTO updateComment(Integer commentId, Integer userId, String content,
                                    List<MultipartFile> files) {
        validateCommentContent(content);

        var comment = commentDAO.getCommentByIdWithTaskAndProject(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));

        verifyProjectAccess(comment.getTask().getProject(), userId);
        verifyCommentOwnership(comment, userId);

        var sanitizedContent = Jsoup.clean(content, Safelist.none());
        comment.setContent(sanitizedContent);
        comment.setEditedAt(new Date());

        if (files != null && !files.isEmpty()) {
            var newAttachments = fileStorageService.storeFiles(files);
            comment.getAttachments().addAll(newAttachments);
        }

        var updatedComment = commentDAO.updateComment(comment);
        initializeLazyCollections(updatedComment);
        return convertToDTO(updatedComment);
    }

    @Transactional
    public void deleteComment(Integer commentId, Integer userId) {
        var comment = commentDAO.getCommentByIdWithTaskAndProject(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));

        verifyProjectAccess(comment.getTask().getProject(), userId);
        verifyCommentOwnership(comment, userId);

        commentDAO.deleteComment(comment);
    }

    @Transactional
    public CommentDTO reactToComment(Integer commentId, Integer userId, ReactionType reactionType) {
        var comment = commentDAO.getCommentByIdWithTaskAndProject(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));

        verifyProjectAccess(comment.getTask().getProject(), userId);

        var user = userDAO.getUserById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        var isNewReaction = processReaction(comment, user, reactionType, commentId);

        if (isNewReaction && isNotCommentAuthor(comment, userId)) {
            notifyCommentAuthorOfReaction(comment);
        }

        var refreshedComment = commentDAO.getCommentById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));
        initializeLazyCollections(refreshedComment);
        return convertToDTO(refreshedComment);
    }

    private void validateCommentContent(String content) {
        if (content == null || content.trim().isEmpty()) {
            throw new ValidationException("Comment content cannot be empty");
        }
        if (content.length() > MAX_COMMENT_LENGTH) {
            throw new ValidationException("Comment exceeds maximum length of " + MAX_COMMENT_LENGTH + " characters");
        }
    }

    private void verifyProjectAccess(Project project, Integer userId) {
        if (!project.hasAccess(userId)) {
            throw new AuthorizationException("Access denied to this project");
        }
    }

    private void verifyCommentOwnership(Comment comment, Integer userId) {
        if (!comment.getAuthor().getId().equals(userId)) {
            throw new AuthorizationException("User not authorized to modify this comment");
        }
    }

    private Map<Integer, List<Comment>> batchLoadReplies(List<Comment> topLevelComments) {
        var parentIds = topLevelComments.stream()
                .map(Comment::getId)
                .toList();

        if (parentIds.isEmpty()) {
            return new HashMap<>();
        }

        var allReplies = commentDAO.getRepliesByParentIds(parentIds);
        return allReplies.stream()
                .collect(Collectors.groupingBy(c -> c.getParentComment().getId()));
    }

    private void initializeLazyCollections(Comment comment) {
        comment.getAttachments().size();
        comment.getReactions().size();
    }

    private void notifyParentCommentAuthorIfDifferentUser(Comment parentComment, Integer userId, Task task) {
        if (parentComment == null || parentComment.getAuthor().getId().equals(userId)) {
            return;
        }
        var message = "Someone replied to your comment on task: " + task.getSummary();
        var link = "/projects?selectedIssue=" + task.getTaskKey();
        notificationService.createNotification(parentComment.getAuthor(), message,
                NotificationType.COMMENT_REPLY, link);
    }

    private boolean processReaction(Comment comment, User user, ReactionType reactionType, Integer commentId) {
        var existingReaction = commentDAO.findReaction(commentId, user.getId());

        if (existingReaction.isPresent()) {
            handleExistingReaction(existingReaction.get(), reactionType);
            return false;
        }

        var newReaction = new CommentReaction(comment, user, reactionType);
        commentDAO.addReaction(newReaction);
        return true;
    }

    private void handleExistingReaction(CommentReaction existingReaction, ReactionType newType) {
        if (existingReaction.getType() == newType) {
            commentDAO.removeReaction(existingReaction);
        } else {
            existingReaction.setType(newType);
            commentDAO.updateReaction(existingReaction);
        }
    }

    private boolean isNotCommentAuthor(Comment comment, Integer userId) {
        return !comment.getAuthor().getId().equals(userId);
    }

    private void notifyCommentAuthorOfReaction(Comment comment) {
        var message = "Someone reacted to your comment on task: " + comment.getTask().getSummary();
        var link = "/projects?selectedIssue=" + comment.getTask().getTaskKey();
        notificationService.createNotification(comment.getAuthor(), message,
                NotificationType.COMMENT_REACTION, link);
    }

    private CommentDTO convertToDTOWithReplies(Comment comment, Map<Integer, List<Comment>> repliesMap) {
        var replies = repliesMap.getOrDefault(comment.getId(), Collections.emptyList())
                .stream()
                .sorted(Comparator.comparing(Comment::getTimestamp))
                .map(c -> convertToDTOWithReplies(c, repliesMap))
                .toList();

        return buildCommentDTO(comment, replies);
    }

    private CommentDTO convertToDTO(Comment comment) {
        return buildCommentDTO(comment, Collections.emptyList());
    }

    private CommentDTO buildCommentDTO(Comment comment, List<CommentDTO> replies) {
        var reactions = Optional.ofNullable(comment.getReactions()).orElse(Collections.emptySet());

        var likedByUsernames = reactions.stream()
                .filter(r -> r.getType() == ReactionType.LIKE)
                .map(r -> r.getUser() != null ? r.getUser().getFullName() : null)
                .filter(Objects::nonNull)
                .toList();

        var dislikedByUsernames = reactions.stream()
                .filter(r -> r.getType() == ReactionType.DISLIKE)
                .map(r -> r.getUser() != null ? r.getUser().getFullName() : null)
                .filter(Objects::nonNull)
                .toList();

        var author = comment.getAuthor();
        var task = comment.getTask();
        var attachments = comment.getAttachments() != null
                ? new ArrayList<>(comment.getAttachments())
                : Collections.<String>emptyList();

        return new CommentDTO(
                comment.getId(),
                task != null ? task.getId() : null,
                author != null ? author.getId() : null,
                author != null ? author.getFullName() : null,
                author != null ? author.getProfilePicture() : null,
                comment.getContent(),
                comment.getTimestamp() != null ? comment.getTimestamp().toInstant() : null,
                comment.getEditedAt() != null ? comment.getEditedAt().toInstant() : null,
                attachments,
                likedByUsernames.size(),
                dislikedByUsernames.size(),
                likedByUsernames,
                dislikedByUsernames,
                replies
        );
    }
}