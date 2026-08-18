package com.backend.mapper;

import com.backend.TestEntityFactory;
import com.backend.dtos.CommentDTO;
import com.backend.dtos.UserDTO;
import com.backend.entities.Comment;
import com.backend.entities.CommentReaction;
import com.backend.entities.Project;
import com.backend.entities.ReactionType;
import com.backend.entities.Task;
import com.backend.entities.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.RecordComponent;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Real entities throughout: the mapper is the thing under test, so nothing about it is stubbed.
 */
@DisplayName("EntityMapper")
class EntityMapperTest {

    private final EntityMapper mapper = new EntityMapper();

    private User owner;
    private User member;
    private Project project;
    private Task task;

    @BeforeEach
    void setUp() {
        owner = TestEntityFactory.createUser(1, "owner@example.com");
        owner.setFirstname("Ada");
        owner.setLastname("Lovelace");
        member = TestEntityFactory.createUser(2, "member@example.com");
        member.setFirstname("Grace");
        member.setLastname("Hopper");
        project = TestEntityFactory.createProjectWithMembers(10, "PROJ", owner, member);
        task = TestEntityFactory.createTask(100, 1, project);
    }

    @Nested
    @DisplayName("user mapping")
    class UserMapping {

        @Test
        @DisplayName("keeps the email-notification preferences out of the view other people see")
        void keepsThePreferencesOutOfTheViewOtherPeopleSee() {
            var componentNames = Arrays.stream(UserDTO.class.getRecordComponents())
                    .map(RecordComponent::getName)
                    .toList();

            assertThat(componentNames).containsExactly(
                    "id", "firstname", "lastname", "email", "profilePicture");
            assertThat(componentNames).doesNotContain(
                    "emailNotificationsEnabled", "emailOnTaskAssigned",
                    "emailOnCommentReply", "emailOnProjectInvitation");
        }

        @Test
        @DisplayName("maps the publicly visible fields of another user")
        void mapsThePubliclyVisibleFieldsOfAnotherUser() {
            owner.setProfilePicture("owner.png");

            var dto = mapper.toUserDTO(owner);

            assertThat(dto.id()).isEqualTo(1);
            assertThat(dto.firstname()).isEqualTo("Ada");
            assertThat(dto.lastname()).isEqualTo("Lovelace");
            assertThat(dto.email()).isEqualTo("owner@example.com");
            assertThat(dto.profilePicture()).isEqualTo("owner.png");
        }

        @Test
        @DisplayName("exposes the email-notification preferences to the signed-in user themselves")
        void exposesThePreferencesToTheSignedInUser() {
            owner.setEmailNotificationsEnabled(true);
            owner.setEmailOnTaskAssigned(false);
            owner.setEmailOnCommentReply(true);
            owner.setEmailOnProjectInvitation(false);

            var dto = mapper.toCurrentUserDTO(owner);

            assertThat(dto.emailNotificationsEnabled()).isTrue();
            assertThat(dto.emailOnTaskAssigned()).isFalse();
            assertThat(dto.emailOnCommentReply()).isTrue();
            assertThat(dto.emailOnProjectInvitation()).isFalse();
            assertThat(dto.email()).isEqualTo("owner@example.com");
        }

        @Test
        @DisplayName("maps a null user to null rather than to an empty DTO")
        void mapsANullUserToNull() {
            assertThat(mapper.toUserDTO(null)).isNull();
            assertThat(mapper.toCurrentUserDTO(null)).isNull();
        }
    }

    @Nested
    @DisplayName("toTaskDTO")
    class ToTaskDTO {

        @Test
        @DisplayName("emits empty lists, never nulls, for a task with no labels, dependencies or attachments")
        void emitsEmptyListsNeverNulls() {
            task.setLabels(null);

            var dto = mapper.toTaskDTO(task, null);

            assertThat(dto.labels()).isNotNull().isEmpty();
            assertThat(dto.dependencyKeys()).isNotNull().isEmpty();
            assertThat(dto.attachments()).isNotNull().isEmpty();
        }

        @Test
        @DisplayName("treats a blank labels column as no labels at all")
        void treatsABlankLabelsColumnAsNoLabels() {
            task.setLabels("   ");

            assertThat(mapper.toTaskDTO(task, null).labels()).isEmpty();
        }

        @Test
        @DisplayName("splits the comma-joined labels column and trims each label")
        void splitsAndTrimsTheLabelsColumn() {
            task.setLabels("bug, urgent ,,  ui ");

            assertThat(mapper.toTaskDTO(task, null).labels())
                    .containsExactly("bug", "urgent", "ui");
        }

        @Test
        @DisplayName("reports whatever criticality the caller passed in, including null and false")
        void reportsWhateverCriticalityTheCallerPassedIn() {
            assertThat(mapper.toTaskDTO(task, Boolean.TRUE).isCritical()).isTrue();
            assertThat(mapper.toTaskDTO(task, Boolean.FALSE).isCritical()).isFalse();
            assertThat(mapper.toTaskDTO(task, null).isCritical()).isNull();
        }

        @Test
        @DisplayName("derives the task key and project key from the owning project")
        void derivesTheTaskKeyAndProjectKey() {
            var dto = mapper.toTaskDTO(task, null);

            assertThat(dto.taskKey()).isEqualTo("PROJ-1");
            assertThat(dto.projectKey()).isEqualTo("PROJ");
            assertThat(dto.taskNumber()).isEqualTo(1);
        }

        @Test
        @DisplayName("lists the task keys of the tasks it depends on")
        void listsTheTaskKeysItDependsOn() {
            var predecessor = TestEntityFactory.createTask(101, 2, project);
            task.replaceDependencies(List.of(predecessor));

            assertThat(mapper.toTaskDTO(task, null).dependencyKeys()).containsExactly("PROJ-2");
        }

        @Test
        @DisplayName("lists dependency keys in a fixed order regardless of the order they were added in")
        void listsDependencyKeysInAFixedOrder() {
            var first = TestEntityFactory.createTask(101, 2, project);
            var second = TestEntityFactory.createTask(102, 3, project);

            task.replaceDependencies(List.of(first, second));
            var ascending = mapper.toTaskDTO(task, null).dependencyKeys();

            task.replaceDependencies(List.of(second, first));
            var descending = mapper.toTaskDTO(task, null).dependencyKeys();

            assertThat(ascending).containsExactly("PROJ-2", "PROJ-3");
            assertThat(descending).containsExactly("PROJ-2", "PROJ-3");
        }

        @Test
        @DisplayName("reports the assignee by email, and null when the task is unassigned")
        void reportsTheAssigneeByEmail() {
            assertThat(mapper.toTaskDTO(task, null).assignee()).isNull();

            task.setAssignee(member);

            assertThat(mapper.toTaskDTO(task, null).assignee()).isEqualTo("member@example.com");
        }

        @Test
        @DisplayName("copies the attachment list instead of handing out the entity's own collection")
        void copiesTheAttachmentList() {
            task.replaceAttachments(List.of("one.png", "two.png"));

            var dto = mapper.toTaskDTO(task, null);

            assertThat(dto.attachments()).containsExactly("one.png", "two.png");
            assertThat(dto.attachments()).isNotSameAs(task.getAttachments());
        }
    }

    @Nested
    @DisplayName("toProjectDTO")
    class ToProjectDTO {

        @Test
        @DisplayName("emits empty lists, never nulls, for a project with no attachments or dependencies")
        void emitsEmptyListsNeverNulls() {
            var bare = TestEntityFactory.createProject(11, "BARE", owner);

            var dto = mapper.toProjectDTO(bare, List.of());

            assertThat(dto.attachments()).isNotNull().isEmpty();
            assertThat(dto.dependencies()).isNotNull().isEmpty();
            assertThat(dto.members()).isNotNull().isEmpty();
            assertThat(dto.tasks()).isNotNull().isEmpty();
        }

        @Test
        @DisplayName("maps the owner and every member through the member-safe user view")
        void mapsTheOwnerAndEveryMember() {
            var dto = mapper.toProjectDTO(project, List.of());

            assertThat(dto.owner().id()).isEqualTo(1);
            assertThat(dto.members()).extracting(UserDTO::email)
                    .containsExactlyInAnyOrder("owner@example.com", "member@example.com");
        }

        @Test
        @DisplayName("lists project dependencies by their project key")
        void listsProjectDependenciesByKey() {
            var upstream = TestEntityFactory.createProject(12, "UPSTREAM", owner);
            project.replaceDependencies(List.of(upstream));

            assertThat(mapper.toProjectDTO(project, List.of()).dependencies())
                    .containsExactly("UPSTREAM");
        }
    }

    @Nested
    @DisplayName("toCommentDTO")
    class ToCommentDTO {

        private Comment comment;

        @BeforeEach
        void createComment() {
            comment = TestEntityFactory.createComment(5, task, owner);
        }

        @Test
        @DisplayName("counts the reactions and flags the current user's own like")
        void countsTheReactionsAndFlagsTheCurrentUsersOwnLike() {
            var third = TestEntityFactory.createUser(3, "third@example.com");
            third.setFirstname("Alan");
            third.setLastname("Turing");
            comment.addReaction(new CommentReaction(comment, member, ReactionType.LIKE));
            comment.addReaction(new CommentReaction(comment, third, ReactionType.LIKE));
            comment.addReaction(new CommentReaction(comment, owner, ReactionType.DISLIKE));

            var dto = mapper.toCommentDTO(comment, member.getId());

            assertThat(dto.likeCount()).isEqualTo(2);
            assertThat(dto.dislikeCount()).isEqualTo(1);
            assertThat(dto.likedByUsernames()).containsExactlyInAnyOrder("Grace Hopper", "Alan Turing");
            assertThat(dto.dislikedByUsernames()).containsExactly("Ada Lovelace");
            assertThat(dto.likedByCurrentUser()).isTrue();
            assertThat(dto.dislikedByCurrentUser()).isFalse();
        }

        @Test
        @DisplayName("flags the current user's own dislike without flagging a like")
        void flagsTheCurrentUsersOwnDislike() {
            comment.addReaction(new CommentReaction(comment, member, ReactionType.LIKE));
            comment.addReaction(new CommentReaction(comment, owner, ReactionType.DISLIKE));

            var dto = mapper.toCommentDTO(comment, owner.getId());

            assertThat(dto.likedByCurrentUser()).isFalse();
            assertThat(dto.dislikedByCurrentUser()).isTrue();
        }

        @Test
        @DisplayName("flags neither for somebody who has not reacted")
        void flagsNeitherForSomebodyWhoHasNotReacted() {
            comment.addReaction(new CommentReaction(comment, member, ReactionType.LIKE));
            comment.addReaction(new CommentReaction(comment, owner, ReactionType.DISLIKE));

            var dto = mapper.toCommentDTO(comment, 99);

            assertThat(dto.likeCount()).isEqualTo(1);
            assertThat(dto.dislikeCount()).isEqualTo(1);
            assertThat(dto.likedByCurrentUser()).isFalse();
            assertThat(dto.dislikedByCurrentUser()).isFalse();
        }

        @Test
        @DisplayName("emits empty lists, never nulls, for a comment with no reactions, attachments or replies")
        void emitsEmptyListsNeverNulls() {
            var dto = mapper.toCommentDTO(comment, owner.getId());

            assertThat(dto.attachments()).isNotNull().isEmpty();
            assertThat(dto.replies()).isNotNull().isEmpty();
            assertThat(dto.likedByUsernames()).isNotNull().isEmpty();
            assertThat(dto.dislikedByUsernames()).isNotNull().isEmpty();
            assertThat(dto.likeCount()).isZero();
            assertThat(dto.dislikeCount()).isZero();
        }

        @Test
        @DisplayName("carries the author's identity and the task it belongs to")
        void carriesTheAuthorsIdentityAndTheTask() {
            owner.setProfilePicture("ada.png");

            var dto = mapper.toCommentDTO(comment, owner.getId());

            assertThat(dto.id()).isEqualTo(5);
            assertThat(dto.taskId()).isEqualTo(100);
            assertThat(dto.authorId()).isEqualTo(1);
            assertThat(dto.authorName()).isEqualTo("Ada Lovelace");
            assertThat(dto.authorProfilePicture()).isEqualTo("ada.png");
            assertThat(dto.content()).isEqualTo("Comment 5");
        }
    }

    @Nested
    @DisplayName("toCommentDTOWithReplies")
    class ToCommentDTOWithReplies {

        @Test
        @DisplayName("nests replies recursively and orders each level by timestamp, not by map order")
        void nestsRepliesRecursivelyInTimestampOrder() {
            var base = Instant.parse("2026-01-01T10:00:00Z");
            var root = commentAt(1, base);
            var older = commentAt(2, base.plus(1, ChronoUnit.MINUTES));
            var newer = commentAt(3, base.plus(5, ChronoUnit.MINUTES));
            var grandchild = commentAt(4, base.plus(9, ChronoUnit.MINUTES));

            Map<Integer, List<Comment>> repliesMap = new HashMap<>();
            // Deliberately out of order: the mapper, not the caller, owns the ordering.
            repliesMap.put(1, List.of(newer, older));
            repliesMap.put(2, List.of(grandchild));

            var dto = mapper.toCommentDTOWithReplies(root, repliesMap, member.getId());

            assertThat(dto.replies()).extracting(CommentDTO::id).containsExactly(2, 3);
            assertThat(dto.replies().get(0).replies()).extracting(CommentDTO::id).containsExactly(4);
            assertThat(dto.replies().get(1).replies()).isNotNull().isEmpty();
        }

        @Test
        @DisplayName("carries the current user's reaction flags down into nested replies")
        void carriesTheReactionFlagsIntoNestedReplies() {
            var base = Instant.parse("2026-01-01T10:00:00Z");
            var root = commentAt(1, base);
            var reply = commentAt(2, base.plus(1, ChronoUnit.MINUTES));
            reply.addReaction(new CommentReaction(reply, member, ReactionType.LIKE));

            var dto = mapper.toCommentDTOWithReplies(root, Map.of(1, List.of(reply)), member.getId());

            assertThat(dto.likedByCurrentUser()).isFalse();
            assertThat(dto.replies().get(0).likedByCurrentUser()).isTrue();
            assertThat(dto.replies().get(0).likeCount()).isEqualTo(1);
        }

        @Test
        @DisplayName("emits an empty reply list for a comment absent from the replies map")
        void emitsAnEmptyReplyListForALeaf() {
            var leaf = commentAt(1, Instant.parse("2026-01-01T10:00:00Z"));

            assertThat(mapper.toCommentDTOWithReplies(leaf, Map.of(), member.getId()).replies())
                    .isNotNull().isEmpty();
        }

        private Comment commentAt(Integer id, Instant timestamp) {
            var comment = TestEntityFactory.createComment(id, task, owner);
            setTimestamp(comment, timestamp);
            return comment;
        }
    }

    /**
     * {@code Comment.timestamp} is write-once and set in the constructor, which is right for
     * production and leaves a test no way to build a deterministic ordering fixture. Reflection
     * here rather than a setter that only tests would ever call.
     */
    private static void setTimestamp(Comment comment, Instant timestamp) {
        try {
            Field field = Comment.class.getDeclaredField("timestamp");
            field.setAccessible(true);
            field.set(comment, timestamp);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("Comment.timestamp is no longer settable by reflection", e);
        }
    }
}
