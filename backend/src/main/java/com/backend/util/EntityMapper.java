package com.backend.util;

import com.backend.dtos.*;
import com.backend.entities.*;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class EntityMapper {

    public UserDTO toUserDTO(User user) {
        if (user == null) return null;
        return new UserDTO(
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

    public TaskDTO toTaskDTO(Task task) {
        var dependencyKeys = extractDependencyKeys(task);
        var labels = parseLabels(task.getLabels());
        var assigneeEmail = task.getAssignee() != null ? task.getAssignee().getEmail() : null;
        var attachments = toListOrEmpty(task.getAttachments());

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
                assigneeEmail,
                labels,
                dependencyKeys,
                null,
                attachments,
                task.getCreated(),
                task.getUpdated(),
                task.getProgress(),
                task.getPriority()
        );
    }

    public ProjectDTO toProjectDTO(Project project, List<TaskDTO> tasks) {
        var members = project.getMembers().stream().map(this::toUserDTO).toList();
        var dependencyKeys = project.getDependencies().stream().map(Project::getProjectKey).toList();
        var attachments = toListOrEmpty(project.getAttachments());

        return new ProjectDTO(
                project.getId(),
                project.getProjectKey(),
                project.getSummary(),
                project.getDescription(),
                tasks,
                members,
                attachments,
                toUserDTO(project.getOwner()),
                dependencyKeys
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
        return buildCommentDTO(comment, Collections.emptyList(), currentUserId);
    }

    public CommentDTO toCommentDTOWithReplies(Comment comment, Map<Integer, List<Comment>> repliesMap, Integer currentUserId) {
        var replies = repliesMap.getOrDefault(comment.getId(), Collections.emptyList())
                .stream()
                .sorted(Comparator.comparing(Comment::getTimestamp))
                .map(c -> toCommentDTOWithReplies(c, repliesMap, currentUserId))
                .toList();
        return buildCommentDTO(comment, replies, currentUserId);
    }

    private CommentDTO buildCommentDTO(Comment comment, List<CommentDTO> replies, Integer currentUserId) {
        var reactions = Optional.ofNullable(comment.getReactions()).orElse(Collections.emptySet());

        var likedByUsernames = new ArrayList<String>();
        var dislikedByUsernames = new ArrayList<String>();
        boolean likedByCurrentUser = false;
        boolean dislikedByCurrentUser = false;

        for (var r : reactions) {
            var name = r.getUser() != null ? r.getUser().getFullName() : null;
            if (name == null) continue;
            boolean isCurrentUser = r.getUser().getId().equals(currentUserId);
            if (r.getType() == ReactionType.LIKE) {
                likedByUsernames.add(name);
                if (isCurrentUser) likedByCurrentUser = true;
            } else if (r.getType() == ReactionType.DISLIKE) {
                dislikedByUsernames.add(name);
                if (isCurrentUser) dislikedByCurrentUser = true;
            }
        }

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
                likedByCurrentUser,
                dislikedByCurrentUser,
                replies
        );
    }

    // --- Helpers ---

    private List<String> extractDependencyKeys(Task task) {
        if (task.getDependencies() == null || task.getDependencies().isEmpty()) {
            return null;
        }
        return task.getDependencies().stream().map(Task::getTaskKey).toList();
    }

    private List<String> parseLabels(String labelsString) {
        if (labelsString == null || labelsString.isEmpty()) return null;
        return Arrays.asList(labelsString.split(","));
    }

    public static <T> List<T> toListOrEmpty(Collection<T> collection) {
        return collection != null ? new ArrayList<>(collection) : new ArrayList<>();
    }

    public static String getFullNameOrNull(User user) {
        return user != null ? user.getFullName() : null;
    }

    public static String getEmailOrNull(User user) {
        return user != null ? user.getEmail() : null;
    }
}
