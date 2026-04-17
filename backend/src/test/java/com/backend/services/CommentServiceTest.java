package com.backend.services;

import com.backend.TestEntityFactory;
import com.backend.dtos.CommentDTO;
import com.backend.entities.*;
import com.backend.events.NotificationEvent;
import com.backend.exception.AuthorizationException;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.repositories.CommentReactionRepository;
import com.backend.repositories.CommentRepository;
import com.backend.repositories.TaskRepository;
import com.backend.repositories.UserRepository;
import com.backend.util.AccessGuard;
import com.backend.util.EntityMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CommentServiceTest {

    @Mock
    private CommentRepository commentRepository;

    @Mock
    private CommentReactionRepository commentReactionRepository;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FileStorageService fileStorageService;

    @Mock
    private TaskActivityService taskActivityService;

    @Mock
    private EntityMapper entityMapper;

    @Mock
    private AccessGuard accessGuard;

    @Mock
    private ApplicationEventPublisher applicationEventPublisher;

    private CommentService commentService;

    private User author;
    private User otherUser;
    private Project project;
    private Task task;

    @BeforeEach
    void setUp() {
        commentService = new CommentService(commentRepository, commentReactionRepository,
                taskRepository, userRepository, fileStorageService, taskActivityService,
                entityMapper, accessGuard, applicationEventPublisher);

        author = TestEntityFactory.createUser(1, "author@example.com");
        otherUser = TestEntityFactory.createUser(2, "other@example.com");
        project = TestEntityFactory.createProject(10, "PROJ", author);
        project.replaceMembers(Set.of(author, otherUser));
        task = TestEntityFactory.createTask(100, 1, project);
    }

    @Nested
    @DisplayName("addComment")
    class AddCommentTests {

        @Test
        @DisplayName("should add comment with sanitized HTML content")
        void shouldAddCommentWithSanitizedContent() {
            when(taskRepository.findById(100)).thenReturn(Optional.of(task));
            when(userRepository.findById(1)).thenReturn(Optional.of(author));
            when(commentRepository.save(any(Comment.class))).thenAnswer(inv -> {
                Comment c = inv.getArgument(0);
                c.setId(1);
                return c;
            });
            when(entityMapper.toCommentDTO(any(Comment.class), eq(1))).thenAnswer(inv -> {
                Comment c = inv.getArgument(0);
                return new CommentDTO(c.getId(), 100, 1, "Author", null,
                        c.getContent(), c.getTimestamp(), null, List.of(),
                        0, 0, List.of(), List.of(), false, false, List.of());
            });

            var result = commentService.addComment(100, 1,
                    "<p>Hello</p><script>alert('xss')</script>", null, null);

            assertNotNull(result);
            // script tag should be stripped by Jsoup sanitization
            assertFalse(result.content().contains("<script>"));
            assertTrue(result.content().contains("<p>Hello</p>"));
        }

        @Test
        @DisplayName("should throw when content is empty")
        void shouldThrowWhenContentEmpty() {
            assertThrows(ValidationException.class, () ->
                    commentService.addComment(100, 1, "", null, null));
        }

        @Test
        @DisplayName("should throw when content is null")
        void shouldThrowWhenContentNull() {
            assertThrows(ValidationException.class, () ->
                    commentService.addComment(100, 1, null, null, null));
        }

        @Test
        @DisplayName("should throw when content exceeds max length")
        void shouldThrowWhenContentTooLong() {
            var longContent = "x".repeat(10001);
            assertThrows(ValidationException.class, () ->
                    commentService.addComment(100, 1, longContent, null, null));
        }

        @Test
        @DisplayName("should throw when task not found")
        void shouldThrowWhenTaskNotFound() {
            when(taskRepository.findById(999)).thenReturn(Optional.empty());

            assertThrows(ResourceNotFoundException.class, () ->
                    commentService.addComment(999, 1, "content", null, null));
        }

        @Test
        @DisplayName("should throw when user has no access to project")
        void shouldThrowWhenNoProjectAccess() {
            when(taskRepository.findById(100)).thenReturn(Optional.of(task));
            doThrow(new ResourceNotFoundException("Project not found"))
                    .when(accessGuard).requireAccess(task.getProject(), 99);

            assertThrows(ResourceNotFoundException.class, () ->
                    commentService.addComment(100, 99, "content", null, null));
        }

        @Test
        @DisplayName("should create reply and notify parent comment author")
        void shouldCreateReplyAndNotifyParentAuthor() {
            var parentComment = TestEntityFactory.createComment(50, task, otherUser);

            when(taskRepository.findById(100)).thenReturn(Optional.of(task));
            when(userRepository.findById(1)).thenReturn(Optional.of(author));
            when(commentRepository.findById(50)).thenReturn(Optional.of(parentComment));
            when(commentRepository.save(any(Comment.class))).thenAnswer(inv -> {
                Comment c = inv.getArgument(0);
                c.setId(2);
                return c;
            });
            when(entityMapper.toCommentDTO(any(Comment.class), eq(1))).thenReturn(
                    new CommentDTO(2, 100, 1, "Author", null, "Reply content",
                            null, null, List.of(), 0, 0, List.of(), List.of(), false, false, List.of()));

            commentService.addComment(100, 1, "Reply content", null, 50);

            var captor = ArgumentCaptor.forClass(NotificationEvent.class);
            verify(applicationEventPublisher, atLeastOnce()).publishEvent(captor.capture());
            assertTrue(captor.getAllValues().stream().anyMatch(e ->
                    e.recipient().equals(otherUser) &&
                    e.message().contains("replied") &&
                    e.type() == NotificationType.COMMENT_REPLY));
        }

        @Test
        @DisplayName("should not notify when replying to own comment")
        void shouldNotNotifyWhenReplyingToOwnComment() {
            var parentComment = TestEntityFactory.createComment(50, task, author);

            when(taskRepository.findById(100)).thenReturn(Optional.of(task));
            when(userRepository.findById(1)).thenReturn(Optional.of(author));
            when(commentRepository.findById(50)).thenReturn(Optional.of(parentComment));
            when(commentRepository.save(any(Comment.class))).thenAnswer(inv -> {
                Comment c = inv.getArgument(0);
                c.setId(2);
                return c;
            });
            when(entityMapper.toCommentDTO(any(Comment.class), eq(1))).thenReturn(
                    new CommentDTO(2, 100, 1, "Author", null, "Self reply",
                            null, null, List.of(), 0, 0, List.of(), List.of(), false, false, List.of()));

            commentService.addComment(100, 1, "Self reply", null, 50);

            verify(applicationEventPublisher, never()).publishEvent(any(NotificationEvent.class));
        }
    }

    @Nested
    @DisplayName("updateComment")
    class UpdateCommentTests {

        @Test
        @DisplayName("should update comment for author")
        void shouldUpdateCommentForAuthor() {
            var comment = TestEntityFactory.createComment(1, task, author);

            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));
            when(commentRepository.save(any(Comment.class))).thenAnswer(inv -> inv.getArgument(0));
            when(entityMapper.toCommentDTO(any(Comment.class), eq(1))).thenReturn(
                    new CommentDTO(1, 100, 1, "Author", null, "Updated content",
                            null, null, List.of(), 0, 0, List.of(), List.of(), false, false, List.of()));

            var result = commentService.updateComment(1, 1, "Updated content", null);

            assertNotNull(result);
            assertNotNull(comment.getEditedAt());
        }

        @Test
        @DisplayName("should throw when non-author tries to update")
        void shouldThrowWhenNonAuthorUpdates() {
            var comment = TestEntityFactory.createComment(1, task, author);

            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));
            doThrow(new AuthorizationException("User not authorized to modify this comment"))
                    .when(accessGuard).requireCommentOwnership(comment, 2);

            assertThrows(AuthorizationException.class, () ->
                    commentService.updateComment(1, 2, "Hacked content", null));
        }

        @Test
        @DisplayName("should sanitize HTML on update")
        void shouldSanitizeHtmlOnUpdate() {
            var comment = TestEntityFactory.createComment(1, task, author);

            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));
            when(commentRepository.save(any(Comment.class))).thenAnswer(inv -> inv.getArgument(0));
            when(entityMapper.toCommentDTO(any(Comment.class), eq(1))).thenReturn(
                    new CommentDTO(1, 100, 1, "Author", null, "<b>Bold</b>",
                            null, null, List.of(), 0, 0, List.of(), List.of(), false, false, List.of()));

            commentService.updateComment(1, 1, "<b>Bold</b><script>evil()</script>", null);

            assertFalse(comment.getContent().contains("<script>"));
            assertTrue(comment.getContent().contains("<b>Bold</b>"));
        }
    }

    @Nested
    @DisplayName("deleteComment")
    class DeleteCommentTests {

        @Test
        @DisplayName("should delete comment for author")
        void shouldDeleteCommentForAuthor() {
            var comment = TestEntityFactory.createComment(1, task, author);

            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));
            when(userRepository.findById(1)).thenReturn(Optional.of(author));

            commentService.deleteComment(1, 1);

            verify(commentRepository).delete(comment);
        }

        @Test
        @DisplayName("should throw when non-author tries to delete")
        void shouldThrowWhenNonAuthorDeletes() {
            var comment = TestEntityFactory.createComment(1, task, author);

            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));
            doThrow(new AuthorizationException("User not authorized to modify this comment"))
                    .when(accessGuard).requireCommentOwnership(comment, 2);

            assertThrows(AuthorizationException.class, () ->
                    commentService.deleteComment(1, 2));
            verify(commentRepository, never()).delete(any());
        }

        @Test
        @DisplayName("should throw when comment not found")
        void shouldThrowWhenCommentNotFound() {
            when(commentRepository.findByIdWithTaskAndProject(999)).thenReturn(Optional.empty());

            assertThrows(ResourceNotFoundException.class, () ->
                    commentService.deleteComment(999, 1));
        }
    }

    @Nested
    @DisplayName("reactToComment")
    class ReactToCommentTests {

        private Comment comment;

        @BeforeEach
        void setUpComment() {
            comment = TestEntityFactory.createComment(1, task, author);
        }

        @Test
        @DisplayName("should add new reaction and notify comment author")
        void shouldAddNewReactionAndNotify() {
            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));
            when(userRepository.findById(2)).thenReturn(Optional.of(otherUser));
            when(commentReactionRepository.findByCommentIdAndUserId(1, 2)).thenReturn(Optional.empty());
            when(entityMapper.toCommentDTO(any(Comment.class), eq(2))).thenReturn(
                    new CommentDTO(1, 100, 1, "Author", null, "content",
                            null, null, List.of(), 1, 0, List.of("Other User"), List.of(), false, false, List.of()));

            commentService.reactToComment(1, 2, ReactionType.LIKE);

            verify(commentReactionRepository).save(any(CommentReaction.class));
            var captor = ArgumentCaptor.forClass(NotificationEvent.class);
            verify(applicationEventPublisher).publishEvent(captor.capture());
            assertEquals(author, captor.getValue().recipient());
            assertTrue(captor.getValue().message().contains("reacted"));
            assertEquals(NotificationType.COMMENT_REACTION, captor.getValue().type());
        }

        @Test
        @DisplayName("should not notify when reacting to own comment")
        void shouldNotNotifyWhenReactingToOwnComment() {
            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));
            when(userRepository.findById(1)).thenReturn(Optional.of(author));
            when(commentReactionRepository.findByCommentIdAndUserId(1, 1)).thenReturn(Optional.empty());
            when(entityMapper.toCommentDTO(any(Comment.class), eq(1))).thenReturn(
                    new CommentDTO(1, 100, 1, "Author", null, "content",
                            null, null, List.of(), 1, 0, List.of("Author"), List.of(), false, false, List.of()));

            commentService.reactToComment(1, 1, ReactionType.LIKE);

            verify(commentReactionRepository).save(any(CommentReaction.class));
            verify(applicationEventPublisher, never()).publishEvent(any(NotificationEvent.class));
        }

        @Test
        @DisplayName("should remove reaction when same type toggled")
        void shouldRemoveReactionWhenSameTypeToggled() {
            var existingReaction = new CommentReaction(comment, otherUser, ReactionType.LIKE);
            existingReaction.setId(10);

            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));
            when(userRepository.findById(2)).thenReturn(Optional.of(otherUser));
            when(commentReactionRepository.findByCommentIdAndUserId(1, 2))
                    .thenReturn(Optional.of(existingReaction));
            when(entityMapper.toCommentDTO(any(Comment.class), eq(2))).thenReturn(
                    new CommentDTO(1, 100, 1, "Author", null, "content",
                            null, null, List.of(), 0, 0, List.of(), List.of(), false, false, List.of()));

            commentService.reactToComment(1, 2, ReactionType.LIKE);

            verify(commentReactionRepository).delete(existingReaction);
            verify(commentReactionRepository, never()).save(any());
        }

        @Test
        @DisplayName("should replace reaction when different type")
        void shouldReplaceReactionWhenDifferentType() {
            var existingReaction = new CommentReaction(comment, otherUser, ReactionType.LIKE);
            existingReaction.setId(10);

            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));
            when(userRepository.findById(2)).thenReturn(Optional.of(otherUser));
            when(commentReactionRepository.findByCommentIdAndUserId(1, 2))
                    .thenReturn(Optional.of(existingReaction));
            when(entityMapper.toCommentDTO(any(Comment.class), eq(2))).thenReturn(
                    new CommentDTO(1, 100, 1, "Author", null, "content",
                            null, null, List.of(), 0, 1, List.of(), List.of("Other User"), false, true, List.of()));

            commentService.reactToComment(1, 2, ReactionType.DISLIKE);

            verify(commentReactionRepository).save(existingReaction);
            assertEquals(ReactionType.DISLIKE, existingReaction.getType());
            verify(commentReactionRepository, never()).delete(any());
        }
    }
}
