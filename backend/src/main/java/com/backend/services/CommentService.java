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
import com.backend.util.ValidationUtil;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class CommentService {

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

    /**
     * Top-level comments for a task, paged, each with its full reply tree.
     *
     * <p>Paged because the previous unbounded version returned every comment on a task plus the
     * whole recursive reply tree and every reactor's name in one response.
     */
    @Transactional(readOnly = true)
    public Page<CommentDTO> getCommentsByTask(Integer taskId, Integer userId, Pageable pageable) {
        var task = accessGuard.getAccessibleTaskById(taskId, userId);
        // Two steps so the database does the paging: a collection fetch and a Pageable in one
        // query makes Hibernate load every top-level comment on the task and slice in memory.
        var ids = commentRepository.findTopLevelCommentIds(task.getId(), pageable);
        if (ids.isEmpty()) {
            return Page.empty(pageable);
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
        validateCommentContent(content);

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
        }

        var attachments = fileStorageService.storeFiles(files, task.getProject().getId(), userId);
        var comment = new Comment(task, author, parentComment, sanitize(content), attachments);
        var savedComment = commentRepository.save(comment);

        taskActivityService.logCommentAdded(task, author);
        notifyAboutNewComment(task, parentComment, author, savedComment.getId());

        return entityMapper.toCommentDTO(savedComment, userId);
    }

    @Transactional(rollbackFor = Exception.class)
    public CommentDTO updateComment(Integer taskId, Integer commentId, Integer userId, String content,
                                    List<MultipartFile> files) {
        validateCommentContent(content);

        var comment = requireOwnEditableComment(taskId, commentId, userId);
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

    /**
     * Adds, switches or removes the caller's reaction.
     *
     * <p>Mutations go through the {@code Comment} aggregate rather than the reaction repository, so
     * the collection the response is built from already reflects the change instead of depending on
     * Hibernate's flush and collection-load ordering.
     */
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

        if (isNewReaction && !comment.getAuthor().getId().equals(userId)) {
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
        // Checked on the already-loaded comment: no second query, no time-of-check gap.
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

    private void validateCommentContent(String content) {
        if (content == null || content.trim().isEmpty()) {
            throw new ValidationException("Comment content cannot be empty");
        }
        if (content.length() > ValidationUtil.MAX_COMMENT_LENGTH) {
            throw new ValidationException("Comment exceeds maximum length of "
                    + ValidationUtil.MAX_COMMENT_LENGTH + " characters");
        }
    }

    private static String sanitize(String content) {
        return HtmlSanitizer.sanitizeComment(content);
    }

    /**
     * One notification per person for one comment: replying to the assignee's own comment on their
     * own task used to send them both a reply notification and a new-comment notification.
     */
    private void notifyAboutNewComment(Task task, Comment parentComment, User author, Integer commentId) {
        var pending = new ArrayList<NotificationService.Pending>(2);
        var link = NotificationService.taskCommentLink(task.getTaskKey(), commentId);

        if (parentComment != null && !parentComment.getAuthor().getId().equals(author.getId())) {
            pending.add(new NotificationService.Pending(parentComment.getAuthor(),
                    "Someone replied to your comment on task: " + task.getSummary(),
                    NotificationType.COMMENT_REPLY, link));
        }
        if (task.getAssignee() != null && !task.getAssignee().getId().equals(author.getId())) {
            pending.add(new NotificationService.Pending(task.getAssignee(),
                    "New comment on task: " + task.getSummary(),
                    NotificationType.TASK_COMMENT, link));
        }
        notificationService.notifyAll(pending);
    }

    /**
     * Loads the whole reply tree in one query per depth level rather than one per comment.
     */
    private Map<Integer, List<Comment>> batchLoadReplies(List<Comment> topLevelComments) {
        var repliesByParent = new HashMap<Integer, List<Comment>>();
        var parentIds = topLevelComments.stream().map(Comment::getId).toList();

        while (!parentIds.isEmpty()) {
            var replies = commentRepository.findRepliesByParentIdsWithDetails(parentIds);
            if (replies.isEmpty()) {
                break;
            }
            for (var reply : replies) {
                repliesByParent
                        .computeIfAbsent(reply.getParentComment().getId(), key -> new ArrayList<>())
                        .add(reply);
            }
            parentIds = replies.stream().map(Comment::getId).toList();
        }
        return repliesByParent;
    }
}
