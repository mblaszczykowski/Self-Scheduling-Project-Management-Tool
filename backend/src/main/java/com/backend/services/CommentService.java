package com.backend.services;

import com.backend.dtos.CommentDTO;
import com.backend.entities.*;
import com.backend.exception.AuthorizationException;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.repositories.CommentReactionRepository;
import com.backend.repositories.CommentRepository;
import com.backend.repositories.TaskRepository;
import com.backend.repositories.UserRepository;
import com.backend.util.ValidationUtil;
import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CommentService {


    private final CommentRepository commentRepository;
    private final CommentReactionRepository commentReactionRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;
    private final NotificationService notificationService;

    public CommentService(CommentRepository commentRepository,
                          CommentReactionRepository commentReactionRepository,
                          TaskRepository taskRepository,
                          UserRepository userRepository,
                          FileStorageService fileStorageService,
                          NotificationService notificationService) {
        this.commentRepository = commentRepository;
        this.commentReactionRepository = commentReactionRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.fileStorageService = fileStorageService;
        this.notificationService = notificationService;
    }

    @Transactional(readOnly = true)
    public List<CommentDTO> getCommentsByTask(Integer taskId, Integer userId) {
        var task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        verifyProjectAccess(task.getProject(), userId);

        var topLevelComments = commentRepository.findTopLevelCommentsByTaskIdWithDetails(taskId);
        var repliesByParentId = batchLoadReplies(topLevelComments);
        return topLevelComments.stream()
                .sorted(Comparator.comparing(Comment::getTimestamp))
                .map(c -> convertToDTOWithReplies(c, repliesByParentId))
                .toList();
    }

    @Transactional(rollbackFor = Exception.class)
    public CommentDTO addComment(Integer taskId, Integer userId, String content,
                                 List<MultipartFile> files, Integer parentCommentId) {
        validateCommentContent(content);

        var task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        verifyProjectAccess(task.getProject(), userId);

        var user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        var attachmentUrls = (files != null && !files.isEmpty())
                ? fileStorageService.storeFiles(files)
                : new ArrayList<String>();

        Comment parentComment = null;
        if (parentCommentId != null) {
            parentComment = commentRepository.findById(parentCommentId)
                    .orElseThrow(() -> new ResourceNotFoundException("Parent comment not found"));
        }

        var sanitizedContent = Jsoup.clean(content, Safelist.basicWithImages());

        var comment = new Comment(task, user, parentComment, sanitizedContent, attachmentUrls);
        var savedComment = commentRepository.save(comment);
        initializeLazyCollections(savedComment);
        notifyParentCommentAuthorIfDifferentUser(parentComment, userId, task);
        return convertToDTO(savedComment);
    }

    @Transactional(rollbackFor = Exception.class)
    public CommentDTO updateComment(Integer commentId, Integer userId, String content,
                                    List<MultipartFile> files) {
        validateCommentContent(content);

        var comment = commentRepository.findByIdWithTaskAndProject(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));

        verifyProjectAccess(comment.getTask().getProject(), userId);
        verifyCommentOwnership(comment, userId);

        var sanitizedContent = Jsoup.clean(content, Safelist.basicWithImages());
        comment.setContent(sanitizedContent);
        comment.setEditedAt(Instant.now());

        if (files != null && !files.isEmpty()) {
            var newAttachments = fileStorageService.storeFiles(files);
            comment.getAttachments().addAll(newAttachments);
        }

        var updatedComment = commentRepository.save(comment);
        initializeLazyCollections(updatedComment);
        return convertToDTO(updatedComment);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteComment(Integer commentId, Integer userId) {
        var comment = commentRepository.findByIdWithTaskAndProject(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));

        verifyProjectAccess(comment.getTask().getProject(), userId);
        verifyCommentOwnership(comment, userId);

        commentRepository.delete(comment);
    }

    @Transactional(rollbackFor = Exception.class)
    public CommentDTO reactToComment(Integer commentId, Integer userId, ReactionType reactionType) {
        var comment = commentRepository.findByIdWithTaskAndProject(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));

        verifyProjectAccess(comment.getTask().getProject(), userId);

        var user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        var isNewReaction = processReaction(comment, user, reactionType, commentId);

        if (isNewReaction && isNotCommentAuthor(comment, userId)) {
            notifyCommentAuthorOfReaction(comment);
        }

        var refreshedComment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));
        initializeLazyCollections(refreshedComment);
        return convertToDTO(refreshedComment);
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
                comment.getTimestamp(),
                comment.getEditedAt(),
                attachments,
                likedByUsernames.size(),
                dislikedByUsernames.size(),
                likedByUsernames,
                dislikedByUsernames,
                replies
        );
    }
}
