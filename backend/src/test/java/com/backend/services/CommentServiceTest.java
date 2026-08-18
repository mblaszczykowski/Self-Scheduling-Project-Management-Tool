package com.backend.services;

import com.backend.TestEntityFactory;
import com.backend.dtos.CommentDTO;
import com.backend.entities.Comment;
import com.backend.entities.CommentReaction;
import com.backend.entities.Notification;
import com.backend.entities.NotificationType;
import com.backend.entities.Project;
import com.backend.entities.ReactionType;
import com.backend.entities.Task;
import com.backend.entities.User;
import com.backend.exception.AuthorizationException;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.mapper.EntityMapper;
import com.backend.repositories.CommentReactionRepository;
import com.backend.repositories.CommentRepository;
import com.backend.repositories.NotificationRepository;
import com.backend.security.AccessGuard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CommentServiceTest {

    @Mock
    private CommentRepository commentRepository;

    @Mock
    private CommentReactionRepository commentReactionRepository;

    @Mock
    private UserService userService;

    @Mock
    private FileStorageService fileStorageService;

    @Mock
    private TaskActivityService taskActivityService;

    @Mock
    private AccessGuard accessGuard;

    // The notification fan-out is exercised through the real NotificationService so that
    // "one notification per person" can be asserted on the rows that would actually be written,
    // rather than on the candidate list handed to a mock.
    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private SseEmitterManager sseEmitterManager;

    @Mock
    private EmailService emailService;

    private final EntityMapper entityMapper = new EntityMapper();

    private CommentService commentService;

    private User author;
    private User otherUser;
    private User assignee;
    private Project project;
    private Task task;

    private static final String COMMENT_LINK = "/projects?selectedIssue=PROJ-1&commentId=501";

    @BeforeEach
    void setUp() {
        author = TestEntityFactory.createUser(1, "author@example.com");
        otherUser = TestEntityFactory.createUser(2, "other@example.com");
        assignee = TestEntityFactory.createUser(3, "assignee@example.com");
        project = TestEntityFactory.createProjectWithMembers(10, "PROJ", author, otherUser, assignee);
        task = TestEntityFactory.createTask(100, 1, project);

        var notificationService = new NotificationService(notificationRepository,
                sseEmitterManager, emailService, entityMapper);
        commentService = new CommentService(commentRepository, commentReactionRepository, userService,
                fileStorageService, taskActivityService, notificationService, entityMapper, accessGuard);
    }

    // ======================== helpers ========================

    private void commentIsSavedWithId(int id) {
        when(commentRepository.save(any(Comment.class))).thenAnswer(invocation -> {
            Comment saved = invocation.getArgument(0);
            saved.setId(id);
            return saved;
        });
    }

    private Comment savedComment() {
        var captor = ArgumentCaptor.forClass(Comment.class);
        verify(commentRepository).save(captor.capture());
        return captor.getValue();
    }

    private List<Notification> savedNotifications() {
        var captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository, times(1)).save(captor.capture());
        return captor.getAllValues();
    }

    private static CommentReaction existingReaction(Comment comment, User user, ReactionType type, int id) {
        var reaction = new CommentReaction(comment, user, type);
        reaction.setId(id);
        comment.addReaction(reaction);
        return reaction;
    }

    private static List<MultipartFile> oneUpload() {
        return List.of(new MockMultipartFile("attachments", "diagram.png", "image/png",
                new byte[]{1, 2, 3}));
    }

    @Nested
    @DisplayName("getCommentsByTask")
    class GetCommentsByTaskTests {

        @Test
        @DisplayName("returns one page of top-level comments with their whole reply tree nested underneath")
        void shouldReturnAPageOfCommentsWithNestedReplies() {
            var first = TestEntityFactory.createComment(1, task, author);
            var second = TestEntityFactory.createComment(2, task, otherUser);
            var reply = TestEntityFactory.createComment(3, task, otherUser);
            reply.setParentComment(first);
            var replyToTheReply = TestEntityFactory.createComment(4, task, author);
            replyToTheReply.setParentComment(reply);
            existingReaction(first, otherUser, ReactionType.LIKE, 90);

            Pageable pageable = PageRequest.of(0, 2);
            Map<Integer, List<Comment>> repliesByParent =
                    Map.of(1, List.of(reply), 3, List.of(replyToTheReply));
            when(accessGuard.getAccessibleTaskById(100, 2)).thenReturn(task);
            when(commentRepository.findTopLevelCommentIds(100, pageable))
                    .thenReturn(new PageImpl<>(List.of(1, 2), pageable, 5));
            when(commentRepository.findTopLevelCommentsWithDetails(List.of(1, 2)))
                    .thenReturn(List.of(first, second));
            when(commentRepository.findRepliesByParentIdsWithDetails(anyList())).thenAnswer(invocation -> {
                List<Integer> parentIds = invocation.getArgument(0);
                return parentIds.stream()
                        .flatMap(id -> repliesByParent.getOrDefault(id, List.<Comment>of()).stream())
                        .toList();
            });

            var page = commentService.getCommentsByTask(100, 2, pageable);

            assertThat(page.getTotalElements()).isEqualTo(5);
            assertThat(page.getContent()).extracting(CommentDTO::id).containsExactly(1, 2);

            var firstDto = page.getContent().getFirst();
            assertThat(firstDto.taskId()).isEqualTo(100);
            assertThat(firstDto.authorId()).isEqualTo(1);
            assertThat(firstDto.authorName()).isEqualTo("User 1");
            assertThat(firstDto.content()).isEqualTo("Comment 1");
            assertThat(firstDto.likeCount()).isEqualTo(1);
            assertThat(firstDto.likedByUsernames()).containsExactly("User 2");
            assertThat(firstDto.likedByCurrentUser()).isTrue();
            assertThat(firstDto.replies()).extracting(CommentDTO::id).containsExactly(3);
            assertThat(firstDto.replies().getFirst().replies())
                    .extracting(CommentDTO::id).containsExactly(4);
            assertThat(page.getContent().get(1).replies()).isEmpty();
        }

        @Test
        @DisplayName("loads the reply tree one level at a time instead of once per comment")
        void shouldBatchTheReplyQueriesByDepth() {
            var first = TestEntityFactory.createComment(1, task, author);
            var second = TestEntityFactory.createComment(2, task, otherUser);
            var replyToFirst = TestEntityFactory.createComment(3, task, otherUser);
            replyToFirst.setParentComment(first);
            var replyToSecond = TestEntityFactory.createComment(4, task, author);
            replyToSecond.setParentComment(second);

            Pageable pageable = PageRequest.of(0, 20);
            when(accessGuard.getAccessibleTaskById(100, 1)).thenReturn(task);
            when(commentRepository.findTopLevelCommentIds(100, pageable))
                    .thenReturn(new PageImpl<>(List.of(1, 2), pageable, 2));
            when(commentRepository.findTopLevelCommentsWithDetails(List.of(1, 2)))
                    .thenReturn(List.of(first, second));
            when(commentRepository.findRepliesByParentIdsWithDetails(List.of(1, 2)))
                    .thenReturn(List.of(replyToFirst, replyToSecond));
            when(commentRepository.findRepliesByParentIdsWithDetails(List.of(3, 4)))
                    .thenReturn(List.of());

            var page = commentService.getCommentsByTask(100, 1, pageable);

            assertThat(page.getContent()).extracting(dto -> dto.replies().getFirst().id())
                    .containsExactly(3, 4);
            // Two levels of the tree, two queries — not one per comment.
            verify(commentRepository, times(2)).findRepliesByParentIdsWithDetails(anyList());
        }

        @Test
        @DisplayName("never reads any comment when the caller cannot see the task")
        void shouldNotReadCommentsWithoutTaskAccess() {
            when(accessGuard.getAccessibleTaskById(100, 99))
                    .thenThrow(new ResourceNotFoundException("Task not found"));

            assertThatThrownBy(() -> commentService.getCommentsByTask(100, 99, PageRequest.of(0, 20)))
                    .isInstanceOf(ResourceNotFoundException.class);

            verifyNoInteractions(commentRepository);
        }
    }

    @Nested
    @DisplayName("addComment")
    class AddCommentTests {

        @Test
        @DisplayName("strips scripts from the stored content and returns the sanitized comment")
        void shouldSanitizeTheContentItStoresAndReturns() {
            var files = oneUpload();
            when(accessGuard.getAccessibleTaskById(100, 1)).thenReturn(task);
            when(userService.getRequiredUserById(1)).thenReturn(author);
            when(fileStorageService.storeFiles(files, 10, 1)).thenReturn(List.of("/files/diagram.png"));
            commentIsSavedWithId(501);

            var result = commentService.addComment(100, 1,
                    "<p>Hello</p><script>alert('xss')</script>", files, null);

            var stored = savedComment();
            assertThat(stored.getContent()).contains("<p>Hello</p>").doesNotContain("<script>");
            assertThat(stored.getTask()).isSameAs(task);
            assertThat(stored.getAuthor()).isSameAs(author);
            assertThat(stored.getParentComment()).isNull();
            assertThat(stored.getAttachments()).containsExactly("/files/diagram.png");

            assertThat(result.id()).isEqualTo(501);
            assertThat(result.content()).isEqualTo(stored.getContent());
            assertThat(result.taskId()).isEqualTo(100);
            assertThat(result.authorId()).isEqualTo(1);
            assertThat(result.authorName()).isEqualTo("User 1");
            assertThat(result.attachments()).containsExactly("/files/diagram.png");
            assertThat(result.editedAt()).isNull();
            assertThat(result.likeCount()).isZero();
            assertThat(result.dislikeCount()).isZero();
            assertThat(result.replies()).isEmpty();

            verify(taskActivityService).logCommentAdded(task, author);
        }

        @Test
        @DisplayName("threads a reply under its parent comment")
        void shouldThreadAReplyUnderItsParent() {
            var parent = TestEntityFactory.createComment(50, task, otherUser);
            when(accessGuard.getAccessibleTaskById(100, 1)).thenReturn(task);
            when(userService.getRequiredUserById(1)).thenReturn(author);
            when(commentRepository.findById(50)).thenReturn(Optional.of(parent));
            commentIsSavedWithId(501);

            var result = commentService.addComment(100, 1, "A reply", null, 50);

            assertThat(savedComment().getParentComment()).isSameAs(parent);
            assertThat(result.content()).isEqualTo("A reply");
        }

        @ParameterizedTest
        @NullAndEmptySource
        @ValueSource(strings = {"   ", "\n\t"})
        @DisplayName("refuses blank content before touching the task or the files")
        void shouldRefuseBlankContent(String content) {
            assertThatThrownBy(() -> commentService.addComment(100, 1, content, null, null))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("cannot be empty");

            verifyNoInteractions(accessGuard, commentRepository, fileStorageService);
        }

        @Test
        @DisplayName("refuses content longer than the allowed maximum")
        void shouldRefuseOverlongContent() {
            assertThatThrownBy(() -> commentService.addComment(100, 1, "x".repeat(10001), null, null))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("10000");

            verifyNoInteractions(accessGuard, commentRepository, fileStorageService);
        }

        @Test
        @DisplayName("refuses to graft a reply onto a comment that lives on another task")
        void shouldRefuseAParentCommentFromAnotherTask() {
            var otherTask = TestEntityFactory.createTask(200, 2, project);
            var parentOnOtherTask = TestEntityFactory.createComment(50, otherTask, otherUser);
            when(accessGuard.getAccessibleTaskById(100, 1)).thenReturn(task);
            when(userService.getRequiredUserById(1)).thenReturn(author);
            when(commentRepository.findById(50)).thenReturn(Optional.of(parentOnOtherTask));

            assertThatThrownBy(() -> commentService.addComment(100, 1, "A reply", oneUpload(), 50))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("Parent comment does not belong to this task");

            // Rejected before anything is written to disk or to the database.
            verify(fileStorageService, never()).storeFiles(anyList(), any(), any());
            verify(commentRepository, never()).save(any());
            verifyNoInteractions(notificationRepository, taskActivityService);
        }

        @Test
        @DisplayName("refuses a reply to a parent comment that does not exist")
        void shouldRefuseAMissingParentComment() {
            when(accessGuard.getAccessibleTaskById(100, 1)).thenReturn(task);
            when(userService.getRequiredUserById(1)).thenReturn(author);
            when(commentRepository.findById(50)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> commentService.addComment(100, 1, "A reply", null, 50))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Parent comment not found");

            verify(commentRepository, never()).save(any());
        }

        @Test
        @DisplayName("stores nothing when the caller has no access to the task's project")
        void shouldStoreNothingWithoutProjectAccess() {
            when(accessGuard.getAccessibleTaskById(100, 99))
                    .thenThrow(new ResourceNotFoundException("Project not found"));

            assertThatThrownBy(() -> commentService.addComment(100, 99, "content", null, null))
                    .isInstanceOf(ResourceNotFoundException.class);

            verify(commentRepository, never()).save(any());
            verifyNoInteractions(fileStorageService, notificationRepository);
        }
    }

    @Nested
    @DisplayName("notifications about a new comment")
    class NewCommentNotificationTests {

        @BeforeEach
        void stubTheHappyPath() {
            when(accessGuard.getAccessibleTaskById(100, 1)).thenReturn(task);
            when(userService.getRequiredUserById(1)).thenReturn(author);
            commentIsSavedWithId(501);
        }

        @Test
        @DisplayName("tells the parent comment's author that someone replied")
        void shouldNotifyTheParentCommentAuthor() {
            var parent = TestEntityFactory.createComment(50, task, otherUser);
            when(commentRepository.findById(50)).thenReturn(Optional.of(parent));

            commentService.addComment(100, 1, "A reply", null, 50);

            var notification = savedNotifications().getFirst();
            assertThat(notification.getUser()).isSameAs(otherUser);
            assertThat(notification.getType()).isEqualTo(NotificationType.COMMENT_REPLY);
            assertThat(notification.getMessage()).isEqualTo(
                    "Someone replied to your comment on task: Task 1");
            assertThat(notification.getLink()).isEqualTo(COMMENT_LINK);
        }

        @Test
        @DisplayName("tells the assignee about a new top-level comment")
        void shouldNotifyTheAssigneeAboutANewComment() {
            task.setAssignee(assignee);

            commentService.addComment(100, 1, "Something to look at", null, null);

            var notification = savedNotifications().getFirst();
            assertThat(notification.getUser()).isSameAs(assignee);
            assertThat(notification.getType()).isEqualTo(NotificationType.TASK_COMMENT);
            assertThat(notification.getMessage()).isEqualTo("New comment on task: Task 1");
            assertThat(notification.getLink()).isEqualTo(COMMENT_LINK);
        }

        @Test
        @DisplayName("sends exactly one notification when the reply is to the assignee's own comment "
                + "on their own task")
        void shouldSendOneNotificationWhenReplyAndAssigneeAreTheSamePerson() {
            task.setAssignee(otherUser);
            var parent = TestEntityFactory.createComment(50, task, otherUser);
            when(commentRepository.findById(50)).thenReturn(Optional.of(parent));

            commentService.addComment(100, 1, "A reply", null, 50);

            // Both a COMMENT_REPLY and a TASK_COMMENT candidate target user 2; only the first
            // one survives, so they are told once rather than twice.
            var notification = savedNotifications().getFirst();
            assertThat(notification.getUser()).isSameAs(otherUser);
            assertThat(notification.getType()).isEqualTo(NotificationType.COMMENT_REPLY);
            verify(sseEmitterManager, times(1)).sendNotification(any(), any());
        }

        @Test
        @DisplayName("notifies both people when the assignee and the replied-to author differ")
        void shouldNotifyBothDistinctRecipients() {
            task.setAssignee(assignee);
            var parent = TestEntityFactory.createComment(50, task, otherUser);
            when(commentRepository.findById(50)).thenReturn(Optional.of(parent));

            commentService.addComment(100, 1, "A reply", null, 50);

            var captor = ArgumentCaptor.forClass(Notification.class);
            verify(notificationRepository, times(2)).save(captor.capture());
            assertThat(captor.getAllValues())
                    .extracting(Notification::getUser, Notification::getType)
                    .containsExactlyInAnyOrder(
                            tuple(otherUser, NotificationType.COMMENT_REPLY),
                            tuple(assignee, NotificationType.TASK_COMMENT));
        }

        @Test
        @DisplayName("notifies nobody when the author is also the assignee and replies to themselves")
        void shouldNotifyNobodyWhenTheAuthorIsTheOnlyPersonInvolved() {
            task.setAssignee(author);
            var ownComment = TestEntityFactory.createComment(50, task, author);
            when(commentRepository.findById(50)).thenReturn(Optional.of(ownComment));

            commentService.addComment(100, 1, "Talking to myself", null, 50);

            verifyNoInteractions(notificationRepository, sseEmitterManager, emailService);
        }

        @Test
        @DisplayName("notifies nobody about a comment on an unassigned task")
        void shouldNotifyNobodyOnAnUnassignedTask() {
            commentService.addComment(100, 1, "Anybody there?", null, null);

            verifyNoInteractions(notificationRepository, sseEmitterManager, emailService);
        }
    }

    @Nested
    @DisplayName("updateComment")
    class UpdateCommentTests {

        @Test
        @DisplayName("sanitizes the new content, stamps the edit time and keeps the old attachments")
        void shouldUpdateSanitizeAndStampTheEdit() {
            var comment = TestEntityFactory.createComment(1, task, author);
            comment.addAttachments(List.of("/files/old.png"));
            var files = oneUpload();
            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));
            when(userService.getRequiredUserById(1)).thenReturn(author);
            when(fileStorageService.storeFiles(files, 10, 1)).thenReturn(List.of("/files/new.png"));
            when(commentRepository.save(any(Comment.class))).thenAnswer(inv -> inv.getArgument(0));

            var result = commentService.updateComment(100, 1, 1,
                    "<b>Bold</b><script>evil()</script>", files);

            assertThat(comment.getContent()).contains("<b>Bold</b>").doesNotContain("<script>");
            assertThat(comment.getEditedAt()).isNotNull();
            assertThat(result.content()).isEqualTo(comment.getContent());
            assertThat(result.editedAt()).isEqualTo(comment.getEditedAt());
            assertThat(result.attachments())
                    .containsExactlyInAnyOrder("/files/old.png", "/files/new.png");
            verify(accessGuard).requireCommentOwnership(comment, 1);
        }

        @Test
        @DisplayName("records a COMMENT_EDITED activity for the editor")
        void shouldLogACommentEditedActivity() {
            var comment = TestEntityFactory.createComment(1, task, author);
            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));
            when(userService.getRequiredUserById(1)).thenReturn(author);
            when(commentRepository.save(any(Comment.class))).thenAnswer(inv -> inv.getArgument(0));

            commentService.updateComment(100, 1, 1, "Updated content", null);

            verify(taskActivityService).logCommentEdited(task, author);
            verify(taskActivityService, never()).logCommentAdded(any(), any());
        }

        @Test
        @DisplayName("refuses an edit by anyone other than the comment's author")
        void shouldRefuseAnEditByANonAuthor() {
            var comment = TestEntityFactory.createComment(1, task, author);
            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));
            doThrow(new AuthorizationException("User not authorized to modify this comment"))
                    .when(accessGuard).requireCommentOwnership(comment, 2);

            assertThatThrownBy(() -> commentService.updateComment(100, 1, 2, "Hacked", null))
                    .isInstanceOf(AuthorizationException.class);

            assertThat(comment.getContent()).isEqualTo("Comment 1");
            assertThat(comment.getEditedAt()).isNull();
            verify(commentRepository, never()).save(any());
            verifyNoInteractions(taskActivityService, fileStorageService);
        }

        @Test
        @DisplayName("refuses a comment id that belongs to a different task")
        void shouldRefuseACommentFromAnotherTask() {
            var otherTask = TestEntityFactory.createTask(200, 2, project);
            var comment = TestEntityFactory.createComment(1, otherTask, author);
            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));

            assertThatThrownBy(() -> commentService.updateComment(100, 1, 1, "Updated", null))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("Comment does not belong to the specified task");

            verify(commentRepository, never()).save(any());
            verifyNoInteractions(fileStorageService);
        }

        @Test
        @DisplayName("refuses blank content without even loading the comment")
        void shouldRefuseBlankContentBeforeLoadingTheComment() {
            assertThatThrownBy(() -> commentService.updateComment(100, 1, 1, "  ", null))
                    .isInstanceOf(ValidationException.class);

            verifyNoInteractions(commentRepository, accessGuard, fileStorageService);
        }

        @Test
        @DisplayName("refuses a comment that does not exist")
        void shouldRefuseAMissingComment() {
            when(commentRepository.findByIdWithTaskAndProject(999)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> commentService.updateComment(100, 999, 1, "Updated", null))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Comment not found");
        }
    }

    @Nested
    @DisplayName("deleteComment")
    class DeleteCommentTests {

        @Test
        @DisplayName("removes the row first and unlinks the attachments only afterwards")
        void shouldDeleteTheRowBeforeUnlinkingTheFiles() {
            var comment = TestEntityFactory.createComment(1, task, author);
            comment.addAttachments(List.of("/files/one.png", "/files/two.png"));
            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));
            when(userService.getRequiredUserById(1)).thenReturn(author);

            commentService.deleteComment(100, 1, 1);

            var inOrder = inOrder(commentRepository, fileStorageService);
            inOrder.verify(commentRepository).delete(comment);
            ArgumentCaptor<Collection<String>> captor = ArgumentCaptor.captor();
            inOrder.verify(fileStorageService).deleteFilesSilently(captor.capture());
            assertThat(captor.getValue())
                    .containsExactlyInAnyOrder("/files/one.png", "/files/two.png");
            verify(taskActivityService).logCommentDeleted(task, author);
        }

        @Test
        @DisplayName("keeps the row deleted even when unlinking the files fails")
        void shouldNotFailTheDeleteWhenUnlinkingFails() {
            var comment = TestEntityFactory.createComment(1, task, author);
            comment.addAttachments(List.of("/files/one.png"));
            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));
            when(userService.getRequiredUserById(1)).thenReturn(author);
            doThrow(new RuntimeException("disk unavailable"))
                    .when(fileStorageService).deleteFilesSilently(anyCollection());

            assertThatCode(() -> commentService.deleteComment(100, 1, 1)).doesNotThrowAnyException();

            verify(commentRepository).delete(comment);
        }

        @Test
        @DisplayName("touches neither the row nor the files when the caller is not the author")
        void shouldDeleteNothingForANonAuthor() {
            var comment = TestEntityFactory.createComment(1, task, author);
            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));
            doThrow(new AuthorizationException("User not authorized to modify this comment"))
                    .when(accessGuard).requireCommentOwnership(comment, 2);

            assertThatThrownBy(() -> commentService.deleteComment(100, 1, 2))
                    .isInstanceOf(AuthorizationException.class);

            verify(commentRepository, never()).delete(any());
            verifyNoInteractions(fileStorageService, taskActivityService);
        }

        @Test
        @DisplayName("refuses a comment id that belongs to a different task")
        void shouldRefuseACommentFromAnotherTask() {
            var otherTask = TestEntityFactory.createTask(200, 2, project);
            var comment = TestEntityFactory.createComment(1, otherTask, author);
            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));

            assertThatThrownBy(() -> commentService.deleteComment(100, 1, 1))
                    .isInstanceOf(ValidationException.class);

            verify(commentRepository, never()).delete(any());
            verifyNoInteractions(fileStorageService);
        }

        @Test
        @DisplayName("refuses a comment that does not exist")
        void shouldRefuseAMissingComment() {
            when(commentRepository.findByIdWithTaskAndProject(999)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> commentService.deleteComment(100, 999, 1))
                    .isInstanceOf(ResourceNotFoundException.class);

            verify(commentRepository, never()).delete(any());
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
        @DisplayName("adds a reaction to the comment itself and counts it in the returned comment")
        void shouldAddAReactionThroughTheAggregate() {
            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));
            when(userService.getRequiredUserById(2)).thenReturn(otherUser);
            when(commentReactionRepository.findByCommentIdAndUserId(1, 2)).thenReturn(Optional.empty());

            var result = commentService.reactToComment(100, 1, 2, ReactionType.LIKE);

            assertThat(result.likeCount()).isEqualTo(1);
            assertThat(result.likedByUsernames()).containsExactly("User 2");
            assertThat(result.likedByCurrentUser()).isTrue();
            assertThat(result.dislikeCount()).isZero();
            assertThat(result.dislikedByCurrentUser()).isFalse();

            // The change lives on the aggregate, not in a separate repository write.
            assertThat(comment.getReactions())
                    .singleElement()
                    .satisfies(reaction -> {
                        assertThat(reaction.getType()).isEqualTo(ReactionType.LIKE);
                        assertThat(reaction.getUser()).isSameAs(otherUser);
                        assertThat(reaction.getComment()).isSameAs(comment);
                    });
            verify(commentReactionRepository, never()).save(any());
        }

        @Test
        @DisplayName("tells the comment's author that somebody reacted")
        void shouldNotifyTheCommentAuthorAboutANewReaction() {
            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));
            when(userService.getRequiredUserById(2)).thenReturn(otherUser);
            when(commentReactionRepository.findByCommentIdAndUserId(1, 2)).thenReturn(Optional.empty());

            commentService.reactToComment(100, 1, 2, ReactionType.LIKE);

            var notification = savedNotifications().getFirst();
            assertThat(notification.getUser()).isSameAs(author);
            assertThat(notification.getType()).isEqualTo(NotificationType.COMMENT_REACTION);
            assertThat(notification.getMessage())
                    .isEqualTo("Someone reacted to your comment on task: Task 1");
            assertThat(notification.getLink())
                    .isEqualTo("/projects?selectedIssue=PROJ-1&commentId=1");
        }

        @Test
        @DisplayName("removes the reaction when the same type is sent a second time")
        void shouldRemoveTheReactionWhenTheSameTypeIsRepeated() {
            var existing = existingReaction(comment, otherUser, ReactionType.LIKE, 10);
            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));
            when(userService.getRequiredUserById(2)).thenReturn(otherUser);
            when(commentReactionRepository.findByCommentIdAndUserId(1, 2))
                    .thenReturn(Optional.of(existing));

            var result = commentService.reactToComment(100, 1, 2, ReactionType.LIKE);

            assertThat(result.likeCount()).isZero();
            assertThat(result.likedByUsernames()).isEmpty();
            assertThat(result.likedByCurrentUser()).isFalse();
            assertThat(comment.getReactions()).isEmpty();
            assertThat(existing.getComment()).isNull();
            // Toggling off is not news, and orphan removal takes care of the row.
            verifyNoInteractions(notificationRepository);
            verify(commentReactionRepository, never()).delete(any());
        }

        @Test
        @DisplayName("switches an existing reaction to the new type instead of adding a second one")
        void shouldSwitchTheExistingReactionType() {
            var existing = existingReaction(comment, otherUser, ReactionType.LIKE, 10);
            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));
            when(userService.getRequiredUserById(2)).thenReturn(otherUser);
            when(commentReactionRepository.findByCommentIdAndUserId(1, 2))
                    .thenReturn(Optional.of(existing));

            var result = commentService.reactToComment(100, 1, 2, ReactionType.DISLIKE);

            assertThat(existing.getType()).isEqualTo(ReactionType.DISLIKE);
            assertThat(comment.getReactions()).hasSize(1);
            assertThat(result.dislikeCount()).isEqualTo(1);
            assertThat(result.dislikedByUsernames()).containsExactly("User 2");
            assertThat(result.dislikedByCurrentUser()).isTrue();
            assertThat(result.likeCount()).isZero();
            assertThat(result.likedByCurrentUser()).isFalse();
            verifyNoInteractions(notificationRepository);
            verify(commentReactionRepository, never()).save(any());
        }

        @Test
        @DisplayName("counts other people's reactions without claiming them for the caller")
        void shouldSeparateOtherPeoplesReactionsFromTheCallers() {
            existingReaction(comment, assignee, ReactionType.LIKE, 11);
            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));
            when(userService.getRequiredUserById(2)).thenReturn(otherUser);
            when(commentReactionRepository.findByCommentIdAndUserId(1, 2)).thenReturn(Optional.empty());

            var result = commentService.reactToComment(100, 1, 2, ReactionType.DISLIKE);

            assertThat(result.likeCount()).isEqualTo(1);
            assertThat(result.likedByUsernames()).containsExactly("User 3");
            assertThat(result.likedByCurrentUser()).isFalse();
            assertThat(result.dislikeCount()).isEqualTo(1);
            assertThat(result.dislikedByUsernames()).containsExactly("User 2");
            assertThat(result.dislikedByCurrentUser()).isTrue();
        }

        @Test
        @DisplayName("does not notify anyone about a reaction to your own comment")
        void shouldNotNotifyWhenReactingToYourOwnComment() {
            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));
            when(userService.getRequiredUserById(1)).thenReturn(author);
            when(commentReactionRepository.findByCommentIdAndUserId(1, 1)).thenReturn(Optional.empty());

            var result = commentService.reactToComment(100, 1, 1, ReactionType.LIKE);

            assertThat(result.likeCount()).isEqualTo(1);
            assertThat(result.likedByCurrentUser()).isTrue();
            verifyNoInteractions(notificationRepository, sseEmitterManager, emailService);
        }

        @Test
        @DisplayName("refuses a comment id that belongs to a different task")
        void shouldRefuseACommentFromAnotherTask() {
            var otherTask = TestEntityFactory.createTask(200, 2, project);
            var commentOnOtherTask = TestEntityFactory.createComment(1, otherTask, author);
            when(commentRepository.findByIdWithTaskAndProject(1))
                    .thenReturn(Optional.of(commentOnOtherTask));

            assertThatThrownBy(() -> commentService.reactToComment(100, 1, 2, ReactionType.LIKE))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("Comment does not belong to the specified task");

            assertThat(commentOnOtherTask.getReactions()).isEmpty();
            verifyNoInteractions(commentReactionRepository, notificationRepository);
        }

        @Test
        @DisplayName("refuses a caller who has no access to the comment's project")
        void shouldRefuseACallerWithoutProjectAccess() {
            when(commentRepository.findByIdWithTaskAndProject(1)).thenReturn(Optional.of(comment));
            doThrow(new ResourceNotFoundException("Project not found"))
                    .when(accessGuard).requireAccess(project, 99);

            assertThatThrownBy(() -> commentService.reactToComment(100, 1, 99, ReactionType.LIKE))
                    .isInstanceOf(ResourceNotFoundException.class);

            assertThat(comment.getReactions()).isEmpty();
            verifyNoInteractions(commentReactionRepository, notificationRepository);
        }

        @Test
        @DisplayName("refuses a comment that does not exist")
        void shouldRefuseAMissingComment() {
            when(commentRepository.findByIdWithTaskAndProject(999)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> commentService.reactToComment(100, 999, 2, ReactionType.LIKE))
                    .isInstanceOf(ResourceNotFoundException.class);
        }
    }
}
