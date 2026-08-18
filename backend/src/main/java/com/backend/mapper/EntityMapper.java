package com.backend.mapper;

import com.backend.dtos.*;
import com.backend.entities.*;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Entity to DTO mapping. Collections are always emitted as lists, never null, so no consumer
 * has to guard two different "empty" representations of the same field.
 */
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

    /**
     * @param isCritical whether the task lies on its project's critical path. An explicit
     *                   parameter rather than a hardcoded null, so every call site has to decide
     *                   — the field used to be silently absent from create/update responses while
     *                   being populated on reads.
     */
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
        var likedByUsernames = new ArrayList<String>();
        var dislikedByUsernames = new ArrayList<String>();
        boolean likedByCurrentUser = false;
        boolean dislikedByCurrentUser = false;

        for (var reaction : comment.getReactions()) {
            var reactor = reaction.getUser();
            if (reactor == null || reactor.getFullName() == null) continue;
            boolean isCurrentUser = reactor.getId().equals(currentUserId);
            if (reaction.getType() == ReactionType.LIKE) {
                likedByUsernames.add(reactor.getFullName());
                likedByCurrentUser |= isCurrentUser;
            } else if (reaction.getType() == ReactionType.DISLIKE) {
                dislikedByUsernames.add(reactor.getFullName());
                dislikedByCurrentUser |= isCurrentUser;
            }
        }

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
                likedByUsernames.size(),
                dislikedByUsernames.size(),
                likedByUsernames,
                dislikedByUsernames,
                likedByCurrentUser,
                dislikedByCurrentUser,
                replies
        );
    }

    /** Task keys of this task's predecessors; empty when it has none. */
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

    private static <T> List<T> toListOrEmpty(Collection<T> collection) {
        return collection != null ? new ArrayList<>(collection) : List.of();
    }
}
