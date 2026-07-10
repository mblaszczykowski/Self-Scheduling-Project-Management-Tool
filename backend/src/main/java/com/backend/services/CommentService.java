package com.backend.services;

import com.backend.dtos.CommentDTO;
import com.backend.entities.*;
import com.backend.events.NotificationEvent;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.repositories.CommentReactionRepository;
import com.backend.repositories.CommentRepository;
import com.backend.repositories.TaskRepository;
import com.backend.repositories.UserRepository;
import com.backend.util.AccessGuard;
import com.backend.util.EntityMapper;
import com.backend.util.ValidationUtil;
import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.*;

@Service
public class CommentService {


    private final CommentRepository commentRepository;
    private final CommentReactionRepository commentReactionRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;
    private final TaskActivityService taskActivityService;
    private final EntityMapper entityMapper;
    private final AccessGuard accessGuard;
    private final ApplicationEventPublisher applicationEventPublisher;

    public CommentService(CommentRepository commentRepository,
                          CommentReactionRepository commentReactionRepository,
                          TaskRepository taskRepository,
                          UserRepository userRepository,
                          FileStorageService fileStorageService,
                          TaskActivityService taskActivityService,
                          EntityMapper entityMapper,
                          AccessGuard accessGuard,
                          ApplicationEventPublisher applicationEventPublisher) {
        this.commentRepository = commentRepository;
        this.commentReactionRepository = commentReactionRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.fileStorageService = fileStorageService;
        this.taskActivityService = taskActivityService;
        this.entityMapper = entityMapper;
        this.accessGuard = accessGuard;
        this.applicationEventPublisher = applicationEventPublisher;
    }

    @Transactional(readOnly = true)
    public List<CommentDTO> getCommentsByTask(Integer taskId, Integer userId) {
        var task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        accessGuard.requireAccess(task.getProject(), userId);

        var topLevelComments = commentRepository.findTopLevelCommentsByTaskIdWithDetails(taskId);
        var repliesByParentId = batchLoadReplies(topLevelComments);
        return topLevelComments.stream()
                .sorted(Comparator.comparing(Comment::getTimestamp))
                .map(c -> entityMapper.toCommentDTOWithReplies(c, repliesByParentId, userId))
                .toList();
    }

    @Transactional(rollbackFor = Exception.class)
    public CommentDTO addComment(Integer taskId, Integer userId, String content,
                                 List<MultipartFile> files, Integer parentCommentId) {
        validateCommentContent(content);

        var task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        accessGuard.requireAccess(task.getProject(), userId);

        var user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Comment parentComment = null;
        if (parentCommentId != null) {
            parentComment = commentRepository.findById(parentCommentId)
                    .orElseThrow(() -> new ResourceNotFoundException("Parent comment not found"));
            // A reply must thread under a comment on the SAME task, otherwise a user could
            // graft replies (and notifications) onto comments in projects they don't belong to.
            if (!parentComment.getTask().getId().equals(taskId)) {
                throw new ValidationException("Parent comment does not belong to this task");
            }
        }

        var attachmentUrls = (files != null && !files.isEmpty())
                ? fileStorageService.storeFiles(files)
                : new ArrayList<String>();

        var sanitizedContent = Jsoup.clean(content, Safelist.basicWithImages());

        var comment = new Comment(task, user, parentComment, sanitizedContent, attachmentUrls);
        var savedComment = commentRepository.save(comment);
        initializeLazyCollections(savedComment);
        taskActivityService.logCommentAdded(task, user);
        notifyParentCommentAuthorIfDifferentUser(parentComment, userId, task, savedComment.getId());
        notifyTaskAssigneeOfNewComment(task, userId, savedComment.getId());
        return entityMapper.toCommentDTO(savedComment, userId);
    }

    @Transactional(rollbackFor = Exception.class)
    public CommentDTO updateComment(Integer commentId, Integer userId, String content,
                                    List<MultipartFile> files) {
        validateCommentContent(content);

        var comment = commentRepository.findByIdWithTaskAndProject(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));

        accessGuard.requireAccess(comment.getTask().getProject(), userId);
        accessGuard.requireCommentOwnership(comment, userId);

        var sanitizedContent = Jsoup.clean(content, Safelist.basicWithImages());
        comment.setContent(sanitizedContent);
        comment.setEditedAt(Instant.now());

        if (files != null && !files.isEmpty()) {
            var newAttachments = fileStorageService.storeFiles(files);
            comment.addAttachments(newAttachments);
        }

        var updatedComment = commentRepository.save(comment);
        initializeLazyCollections(updatedComment);
        return entityMapper.toCommentDTO(updatedComment, userId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteComment(Integer commentId, Integer userId) {
        var comment = commentRepository.findByIdWithTaskAndProject(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));

        accessGuard.requireAccess(comment.getTask().getProject(), userId);
        accessGuard.requireCommentOwnership(comment, userId);

        var user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        taskActivityService.logCommentDeleted(comment.getTask(), user);

        commentRepository.delete(comment);
    }

    @Transactional(rollbackFor = Exception.class)
    public CommentDTO reactToComment(Integer commentId, Integer userId, ReactionType reactionType) {
        var comment = commentRepository.findByIdWithTaskAndProject(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));

        accessGuard.requireAccess(comment.getTask().getProject(), userId);

        var user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        var isNewReaction = processReaction(comment, user, reactionType, commentId);

        if (isNewReaction && isNotCommentAuthor(comment, userId)) {
            notifyCommentAuthorOfReaction(comment);
        }

        initializeLazyCollections(comment);
        return entityMapper.toCommentDTO(comment, userId);
    }

    public void verifyCommentBelongsToTask(Integer commentId, Integer taskId) {
        var comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));
        if (!comment.getTask().getId().equals(taskId)) {
            throw new ValidationException("Comment does not belong to the specified task");
        }
    }

    private void validateCommentContent(String content) {
        if (content == null || content.trim().isEmpty()) {
            throw new ValidationException("Comment content cannot be empty");
        }
        if (content.length() > ValidationUtil.MAX_COMMENT_LENGTH) {
            throw new ValidationException("Comment exceeds maximum length of " + ValidationUtil.MAX_COMMENT_LENGTH + " characters");
        }
    }

    private Map<Integer, List<Comment>> batchLoadReplies(List<Comment> topLevelComments) {
        var allRepliesMap = new HashMap<Integer, List<Comment>>();
        var currentParentIds = topLevelComments.stream()
                .map(Comment::getId)
                .toList();

        while (!currentParentIds.isEmpty()) {
            var replies = commentRepository.findRepliesByParentIdsWithDetails(currentParentIds);
            if (replies.isEmpty()) break;

            for (var reply : replies) {
                allRepliesMap.computeIfAbsent(reply.getParentComment().getId(), k -> new ArrayList<>()).add(reply);
            }

            currentParentIds = replies.stream()
                    .map(Comment::getId)
                    .toList();
        }

        return allRepliesMap;
    }

    private void initializeLazyCollections(Comment comment) {
        comment.getAttachments().size();
        comment.getReactions().size();
    }

    private void notifyParentCommentAuthorIfDifferentUser(Comment parentComment, Integer userId, Task task, Integer commentId) {
        if (parentComment == null || parentComment.getAuthor().getId().equals(userId)) {
            return;
        }
        var message = "Someone replied to your comment on task: " + task.getSummary();
        var link = "/projects?selectedIssue=" + task.getTaskKey() + "&commentId=" + commentId;
        applicationEventPublisher.publishEvent(new NotificationEvent(parentComment.getAuthor(), message,
                NotificationType.COMMENT_REPLY, link));
    }

    private void notifyTaskAssigneeOfNewComment(Task task, Integer commentAuthorId, Integer commentId) {
        if (task.getAssignee() == null || task.getAssignee().getId().equals(commentAuthorId)) {
            return;
        }
        var message = "New comment on task: " + task.getSummary();
        var link = "/projects?selectedIssue=" + task.getTaskKey() + "&commentId=" + commentId;
        applicationEventPublisher.publishEvent(new NotificationEvent(task.getAssignee(), message,
                NotificationType.TASK_COMMENT, link));
    }

    private boolean processReaction(Comment comment, User user, ReactionType reactionType, Integer commentId) {
        var existingReaction = commentReactionRepository.findByCommentIdAndUserId(commentId, user.getId());

        if (existingReaction.isPresent()) {
            handleExistingReaction(existingReaction.get(), reactionType);
            return false;
        }

        var newReaction = new CommentReaction(comment, user, reactionType);
        commentReactionRepository.save(newReaction);
        return true;
    }

    private void handleExistingReaction(CommentReaction existingReaction, ReactionType newType) {
        if (existingReaction.getType() == newType) {
            commentReactionRepository.delete(existingReaction);
        } else {
            existingReaction.setType(newType);
            commentReactionRepository.save(existingReaction);
        }
    }

    private boolean isNotCommentAuthor(Comment comment, Integer userId) {
        return !comment.getAuthor().getId().equals(userId);
    }

    private void notifyCommentAuthorOfReaction(Comment comment) {
        var message = "Someone reacted to your comment on task: " + comment.getTask().getSummary();
        var link = "/projects?selectedIssue=" + comment.getTask().getTaskKey() + "&commentId=" + comment.getId();
        applicationEventPublisher.publishEvent(new NotificationEvent(comment.getAuthor(), message,
                NotificationType.COMMENT_REACTION, link));
    }
}
