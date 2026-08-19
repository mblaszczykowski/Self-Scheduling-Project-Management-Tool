package com.backend.mapper;

import com.backend.dtos.*;
import com.backend.entities.*;
import com.backend.exception.ValidationException;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Component
public class EntityMapper {
    public UserDTO toUserDTO(User user) {
        if (user == null) return null;
        return new UserDTO(
                user.getId(),
                user.getFirstname(),
                user.getLastname(),
                user.getEmail(),
                user.getProfilePicture()
        );
    }

    public CurrentUserDTO toCurrentUserDTO(User user) {
        if (user == null) return null;
        return new CurrentUserDTO(
                user.getId(),
                user.getFirstname(),
                user.getLastname(),
                user.getEmail(),
                user.getProfilePicture(),
                user.getEmailNotificationsEnabled(),
                user.getEmailOnTaskAssigned(),
                user.getEmailOnCommentReply(),
                user.getEmailOnProjectInvitation()
        );
    }

    public NotificationDTO toNotificationDTO(Notification notification) {
        return new NotificationDTO(
                notification.getId(),
                notification.getMessage(),
                notification.getTimestamp(),
                notification.getIsRead(),
                notification.getType(),
                notification.getLink()
        );
    }

    public TaskDTO toTaskDTO(Task task, Boolean isCritical) {
        return new TaskDTO(
                task.getId(),
                task.getTaskNumber(),
                task.getTaskKey(),
                task.getProject().getProjectKey(),
                task.getSummary(),
                task.getDescription(),
                task.getStatus(),
                task.getStartDate(),
                task.getDueDate(),
                task.getAssignee() != null ? task.getAssignee().getEmail() : null,
                parseLabels(task.getLabels()),
                extractDependencyKeys(task),
                isCritical,
                null,
                toListOrEmpty(task.getAttachments()),
                task.getCreated(),
                task.getUpdated(),
                task.getProgress(),
                task.getPriority()
        );
    }

    public ProjectDTO toProjectDTO(Project project, List<TaskDTO> tasks) {
        return new ProjectDTO(
                project.getId(),
                project.getProjectKey(),
                project.getSummary(),
                project.getDescription(),
                tasks,
                project.getMembers().stream().map(this::toUserDTO).toList(),
                toListOrEmpty(project.getAttachments()),
                toUserDTO(project.getOwner()),
                project.getDependencies().stream().map(Project::getProjectKey).toList(),
                project.getCreated(),
                project.getUpdated()
        );
    }

    public TaskActivityDTO toTaskActivityDTO(TaskActivity activity) {
        var author = activity.getAuthor();
        return new TaskActivityDTO(
                activity.getId(),
                activity.getType(),
                activity.getFieldName(),
                activity.getOldValue(),
                activity.getNewValue(),
                author != null ? author.getFullName() : null,
                author != null ? author.getProfilePicture() : null,
                activity.getTimestamp()
        );
    }

    public CommentDTO toCommentDTO(Comment comment, Integer currentUserId) {
        return buildCommentDTO(comment, List.of(), currentUserId);
    }

    public CommentDTO toCommentDTOWithReplies(Comment comment,
                                              Map<Integer, List<Comment>> repliesMap,
                                              Integer currentUserId) {
        var replies = repliesMap.getOrDefault(comment.getId(), Collections.emptyList())
                .stream()
                .sorted(Comparator.comparing(Comment::getTimestamp))
                .map(c -> toCommentDTOWithReplies(c, repliesMap, currentUserId))
                .toList();
        return buildCommentDTO(comment, replies, currentUserId);
    }

    private CommentDTO buildCommentDTO(Comment comment, List<CommentDTO> replies, Integer currentUserId) {
        var reactions = summarizeReactions(comment, currentUserId);
        var author = comment.getAuthor();
        var task = comment.getTask();

        return new CommentDTO(
                comment.getId(),
                task != null ? task.getId() : null,
                author != null ? author.getId() : null,
                author != null ? author.getFullName() : null,
                author != null ? author.getProfilePicture() : null,
                comment.getContent(),
                comment.getTimestamp(),
                comment.getEditedAt(),
                toListOrEmpty(comment.getAttachments()),
                reactions.likes(),
                reactions.dislikes(),
                reactions.likedByCurrentUser(),
                reactions.dislikedByCurrentUser(),
                replies
        );
    }

    private record ReactionSummary(int likes, int dislikes,
                                   boolean likedByCurrentUser, boolean dislikedByCurrentUser) {}

    private static ReactionSummary summarizeReactions(Comment comment, Integer currentUserId) {
        int likes = 0;
        int dislikes = 0;
        boolean likedByCurrentUser = false;
        boolean dislikedByCurrentUser = false;

        for (var reaction : comment.getReactions()) {
            var reactor = reaction.getUser();
            if (reactor == null || reactor.getFullName() == null) continue;
            boolean isCurrentUser = reactor.getId().equals(currentUserId);
            if (reaction.getType() == ReactionType.LIKE) {
                likes++;
                likedByCurrentUser |= isCurrentUser;
            } else if (reaction.getType() == ReactionType.DISLIKE) {
                dislikes++;
                dislikedByCurrentUser |= isCurrentUser;
            }
        }

        return new ReactionSummary(likes, dislikes, likedByCurrentUser, dislikedByCurrentUser);
    }

    public static List<String> extractDependencyKeys(Task task) {
        return task.getDependencies().stream().map(Task::getTaskKey).sorted().toList();
    }

    public static List<String> parseLabels(String labelsString) {
        if (labelsString == null || labelsString.isBlank()) {
            return List.of();
        }
        return Arrays.stream(labelsString.split(","))
                .map(String::trim)
                .filter(label -> !label.isEmpty())
                .toList();
    }

    public static String joinLabels(List<String> labels) {
        var cleaned = (labels == null ? List.<String>of() : labels).stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(label -> !label.isEmpty())
                .toList();
        for (var label : cleaned) {
            if (label.contains(",")) {
                throw new ValidationException("Labels cannot contain commas");
            }
        }
        return cleaned.isEmpty() ? null : String.join(",", cleaned);
    }

    private static <T> List<T> toListOrEmpty(Collection<T> collection) {
        return collection != null ? new ArrayList<>(collection) : List.of();
    }
}
