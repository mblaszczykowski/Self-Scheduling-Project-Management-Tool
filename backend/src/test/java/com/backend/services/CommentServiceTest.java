package com.backend.services;

import com.backend.TestEntityFactory;
import com.backend.entities.*;
import com.backend.exception.AuthorizationException;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.repositories.CommentReactionRepository;
import com.backend.repositories.CommentRepository;
import com.backend.repositories.TaskRepository;
import com.backend.repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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
    private NotificationService notificationService;

    private CommentService commentService;

    private User author;
    private User otherUser;
    private Project project;
    private Task task;

    @BeforeEach
    void setUp() {
        commentService = new CommentService(commentRepository, commentReactionRepository,
                taskRepository, userRepository, fileStorageService, notificationService);

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

            commentService.addComment(100, 1, "Reply content", null, 50);

            verify(notificationService).createNotification(
                    eq(otherUser), contains("replied"), eq(NotificationType.COMMENT_REPLY), anyString());
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

            commentService.addComment(100, 1, "Self reply", null, 50);

            verify(notificationService, never()).createNotification(any(), anyString(), any(), anyString());
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

            var result = commentService.updateComment(1, 1, "Updated content", null);

            assertNotNull(result);
            assertNotNull(comment.getEditedAt());
        }

        @Test
        @DisplayName("should throw when non-author tries to update")
        void shouldThrowWhenNonAuthorUpdates() {
            var comment = TestEntityFactory.createComment(1, task, author);

            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));

            assertThrows(AuthorizationException.class, () ->
                    commentService.updateComment(1, 2, "Hacked content", null));
        }

        @Test
        @DisplayName("should sanitize HTML on update")
        void shouldSanitizeHtmlOnUpdate() {
            var comment = TestEntityFactory.createComment(1, task, author);

            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));
            when(commentRepository.save(any(Comment.class))).thenAnswer(inv -> inv.getArgument(0));

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

            commentService.deleteComment(1, 1);

            verify(commentRepository).delete(comment);
        }

        @Test
        @DisplayName("should throw when non-author tries to delete")
        void shouldThrowWhenNonAuthorDeletes() {
            var comment = TestEntityFactory.createComment(1, task, author);

            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));

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

            commentService.reactToComment(1, 2, ReactionType.LIKE);

            verify(commentReactionRepository).save(any(CommentReaction.class));
            verify(notificationService).createNotification(
                    eq(author), contains("reacted"), eq(NotificationType.COMMENT_REACTION), anyString());
        }

        @Test
        @DisplayName("should not notify when reacting to own comment")
        void shouldNotNotifyWhenReactingToOwnComment() {
            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));
            when(userRepository.findById(1)).thenReturn(Optional.of(author));
            when(commentReactionRepository.findByCommentIdAndUserId(1, 1)).thenReturn(Optional.empty());

            commentService.reactToComment(1, 1, ReactionType.LIKE);

            verify(commentReactionRepository).save(any(CommentReaction.class));
            verify(notificationService, never()).createNotification(any(), anyString(), any(), anyString());
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

            commentService.reactToComment(1, 2, ReactionType.DISLIKE);

            verify(commentReactionRepository).save(existingReaction);
            assertEquals(ReactionType.DISLIKE, existingReaction.getType());
            verify(commentReactionRepository, never()).delete(any());
        }
    }
}
