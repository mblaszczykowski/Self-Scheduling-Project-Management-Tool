package com.backend.services;

import com.backend.dtos.CommentDTO;
import com.backend.entities.Comment;
import com.backend.entities.CommentReaction;
import com.backend.entities.NotificationType;
import com.backend.entities.ReactionType;
import com.backend.entities.Task;
import com.backend.entities.User;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.mapper.EntityMapper;
import com.backend.repositories.CommentReactionRepository;
import com.backend.repositories.CommentRepository;
import com.backend.security.AccessGuard;
import com.backend.util.AfterCommit;
import com.backend.util.HtmlSanitizer;
import com.backend.util.FileValidationConstants;
import com.backend.util.ValidationUtil;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.jsoup.Jsoup;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.HashSet;

@Service
public class CommentService {
    // Bound both recursive DTO rendering and the number of queries needed for a thread.
    private static final int MAX_REPLY_DEPTH = 20;
    private final CommentRepository commentRepository;
    private final CommentReactionRepository commentReactionRepository;
    private final UserService userService;
    private final FileStorageService fileStorageService;
    private final TaskActivityService taskActivityService;
    private final NotificationService notificationService;
    private final EntityMapper entityMapper;
    private final AccessGuard accessGuard;

    public CommentService(CommentRepository commentRepository,
                          CommentReactionRepository commentReactionRepository,
                          UserService userService,
                          FileStorageService fileStorageService,
                          TaskActivityService taskActivityService,
                          NotificationService notificationService,
                          EntityMapper entityMapper,
                          AccessGuard accessGuard) {
        this.commentRepository = commentRepository;
        this.commentReactionRepository = commentReactionRepository;
        this.userService = userService;
        this.fileStorageService = fileStorageService;
        this.taskActivityService = taskActivityService;
        this.notificationService = notificationService;
        this.entityMapper = entityMapper;
        this.accessGuard = accessGuard;
    }

    @Transactional(readOnly = true)
    public Page<CommentDTO> getCommentsByTask(Integer taskId, Integer userId, Pageable pageable) {
        var task = accessGuard.getAccessibleTaskById(taskId, userId);
        var ids = commentRepository.findTopLevelCommentIds(task.getId(), pageable);
        if (ids.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, ids.getTotalElements());
        }
        var topLevel = commentRepository.findTopLevelCommentsWithDetails(ids.getContent());
        var repliesByParentId = batchLoadReplies(topLevel);
        var dtos = topLevel.stream()
                .map(comment -> entityMapper.toCommentDTOWithReplies(comment, repliesByParentId, userId))
                .toList();
        return new PageImpl<>(dtos, pageable, ids.getTotalElements());
    }

    @Transactional(rollbackFor = Exception.class)
    public CommentDTO addComment(Integer taskId, Integer userId, String content,
                                 List<MultipartFile> files, Integer parentCommentId) {
        var task = accessGuard.getAccessibleTaskById(taskId, userId);
        var author = userService.getRequiredUserById(userId);

        Comment parentComment = null;
        if (parentCommentId != null) {
            parentComment = commentRepository.findById(parentCommentId)
                    .orElseThrow(() -> new ResourceNotFoundException("Parent comment not found"));
            if (!parentComment.getTask().getId().equals(taskId)
                    || !parentComment.getTask().getProject().hasAccess(userId)) {
                throw new ResourceNotFoundException("Parent comment not found");
            }
            validateReplyDepth(parentComment);
        }

        var sanitized = sanitize(content);
        var attachments = fileStorageService.storeFiles(files, task.getProject().getId(), userId);
        var comment = new Comment(task, author, parentComment, sanitized, attachments);
        var savedComment = commentRepository.save(comment);

        taskActivityService.logCommentAdded(task, author);
        notifyAboutNewComment(task, parentComment, author, savedComment.getId());

        return entityMapper.toCommentDTO(savedComment, userId);
    }

    @Transactional(rollbackFor = Exception.class)
    public CommentDTO updateComment(Integer taskId, Integer commentId, Integer userId, String content,
                                    List<MultipartFile> files) {
        var comment = requireOwnEditableComment(taskId, commentId, userId);
        if ((long) comment.getAttachments().size() + (files == null ? 0 : files.size())
                > FileValidationConstants.MAX_ATTACHMENTS_PER_ENTITY) {
            throw new ValidationException("A comment cannot have more than 50 attachments");
        }
        comment.setContent(sanitize(content));
        comment.setEditedAt(Instant.now());
        comment.addAttachments(fileStorageService.storeFiles(
                files, comment.getTask().getProject().getId(), userId));

        var updated = commentRepository.save(comment);
        taskActivityService.logCommentEdited(comment.getTask(), userService.getRequiredUserById(userId));
        return entityMapper.toCommentDTO(updated, userId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteComment(Integer taskId, Integer commentId, Integer userId) {
        var comment = requireOwnEditableComment(taskId, commentId, userId);
        var author = userService.getRequiredUserById(userId);
        taskActivityService.logCommentDeleted(comment.getTask(), author);

        var attachments = new ArrayList<>(comment.getAttachments());
        for (var replies : batchLoadReplies(List.of(comment)).values()) {
            for (var reply : replies) {
                attachments.addAll(reply.getAttachments());
            }
        }
        commentRepository.delete(comment);
        AfterCommit.run("delete attachments of comment " + commentId,
                () -> fileStorageService.deleteFilesSilently(attachments));
    }

    @Transactional(rollbackFor = Exception.class)
    public CommentDTO reactToComment(Integer taskId, Integer commentId, Integer userId,
                                     ReactionType reactionType) {
        var comment = commentRepository.findByIdWithTaskAndProject(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));
        requireCommentAccessibleFromTask(comment, taskId, userId);

        var user = userService.getRequiredUserById(userId);
        var existing = commentReactionRepository.findByCommentIdAndUserId(commentId, userId);
        boolean isNewReaction = false;

        if (existing.isPresent()) {
            var reaction = existing.get();
            if (reaction.getType() == reactionType) {
                comment.removeReaction(reaction);
            } else {
                reaction.setType(reactionType);
            }
        } else {
            comment.addReaction(new CommentReaction(comment, user, reactionType));
            isNewReaction = true;
        }

        if (isNewReaction && comment.getTask().getProject().hasAccess(comment.getAuthor().getId())
                && !comment.getAuthor().getId().equals(userId)) {
            notificationService.createNotification(comment.getAuthor(),
                    "Someone reacted to your comment on task: " + comment.getTask().getSummary(),
                    NotificationType.COMMENT_REACTION,
                    NotificationService.taskCommentLink(comment.getTask().getTaskKey(), commentId));
        }

        return entityMapper.toCommentDTO(comment, userId);
    }

    private Comment requireOwnEditableComment(Integer taskId, Integer commentId, Integer userId) {
        var comment = commentRepository.findByIdWithTaskAndProject(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));
        requireCommentAccessibleFromTask(comment, taskId, userId);
        accessGuard.requireCommentOwnership(comment, userId);
        return comment;
    }

    private void requireCommentAccessibleFromTask(Comment comment, Integer taskId, Integer userId) {
        if (!comment.getTask().getId().equals(taskId)
                || !comment.getTask().getProject().hasAccess(userId)) {
            throw new ResourceNotFoundException("Comment not found");
        }
    }

    private static String sanitize(String content) {
        if (content == null || content.length() > ValidationUtil.MAX_COMMENT_LENGTH) {
            throw new ValidationException("Invalid comment content");
        }
        var sanitized = HtmlSanitizer.sanitizeComment(content);
        var parsed = Jsoup.parseBodyFragment(sanitized);
        if (parsed.text().replace('\u00a0', ' ').isBlank() && parsed.select("img[src]").isEmpty()) {
            throw new ValidationException("Comment content cannot be empty");
        }
        return sanitized;
    }

    private static void validateReplyDepth(Comment parent) {
        var visited = new HashSet<Integer>();
        int depth = 0;
        for (var current = parent; current != null; current = current.getParentComment()) {
            if (++depth > MAX_REPLY_DEPTH || !visited.add(current.getId())) {
                throw new ValidationException("A comment thread cannot exceed " + MAX_REPLY_DEPTH + " reply levels");
            }
        }
    }

    private void notifyAboutNewComment(Task task, Comment parentComment, User author, Integer commentId) {
        var pending = new ArrayList<NotificationService.Pending>(2);
        var link = NotificationService.taskCommentLink(task.getTaskKey(), commentId);

        if (parentComment != null && task.getProject().hasAccess(parentComment.getAuthor().getId())
                && !parentComment.getAuthor().getId().equals(author.getId())) {
            pending.add(new NotificationService.Pending(parentComment.getAuthor(),
                    "Someone replied to your comment on task: " + task.getSummary(),
                    NotificationType.COMMENT_REPLY, link));
        }
        if (task.getAssignee() != null && task.getProject().hasAccess(task.getAssignee().getId())
                && !task.getAssignee().getId().equals(author.getId())) {
            pending.add(new NotificationService.Pending(task.getAssignee(),
                    "New comment on task: " + task.getSummary(),
                    NotificationType.TASK_COMMENT, link));
        }
        notificationService.notifyAll(pending);
    }

    private Map<Integer, List<Comment>> batchLoadReplies(List<Comment> topLevelComments) {
        var repliesByParent = new HashMap<Integer, List<Comment>>();
        var visited = new HashSet<Integer>();
        var parentIds = topLevelComments.stream().map(Comment::getId).toList();
        visited.addAll(parentIds);

        while (!parentIds.isEmpty()) {
            var replies = commentRepository.findRepliesByParentIdsWithDetails(parentIds);
            if (replies.isEmpty()) {
                break;
            }
            for (var reply : replies) {
                if (!visited.add(reply.getId())) {
                    throw new ValidationException("Circular comment thread detected");
                }
                repliesByParent
                        .computeIfAbsent(reply.getParentComment().getId(), key -> new ArrayList<>())
                        .add(reply);
            }
            parentIds = replies.stream().map(Comment::getId).toList();
        }
        return repliesByParent;
    }
}
