package com.backend.services;

import com.backend.TestEntityFactory;
import com.backend.dtos.NotificationDTO;
import com.backend.entities.Notification;
import com.backend.entities.NotificationType;
import com.backend.entities.User;
import com.backend.exception.AuthorizationException;
import com.backend.mapper.EntityMapper;
import com.backend.repositories.NotificationRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private SseEmitterManager sseEmitterManager;

    @Mock
    private EmailService emailService;

    /** Real mapper: the DTO handed to the SSE stream is then the one production would push. */
    private final EntityMapper entityMapper = new EntityMapper();

    private NotificationService notificationService;

    private User user;
    private User otherUser;

    @BeforeEach
    void setUp() {
        notificationService = new NotificationService(notificationRepository,
                sseEmitterManager, emailService, entityMapper);
        user = TestEntityFactory.createUser(1, "user@example.com");
        otherUser = TestEntityFactory.createUser(2, "other@example.com");
    }

    @AfterEach
    void clearAnySimulatedTransaction() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    /** Mimics the id JPA would assign on insert, so the mapped DTO carries a real id. */
    private void assignIdsOnSave() {
        var nextId = new AtomicInteger(500);
        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification saved = invocation.getArgument(0);
            saved.setId(nextId.getAndIncrement());
            return saved;
        });
    }

    private static User wantingEveryEmail(Integer id, String email) {
        var recipient = TestEntityFactory.createUser(id, email);
        recipient.setEmailNotificationsEnabled(true);
        recipient.setEmailOnTaskAssigned(true);
        recipient.setEmailOnCommentReply(true);
        recipient.setEmailOnProjectInvitation(true);
        return recipient;
    }

    private List<Notification> savedNotifications() {
        var captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository, times(1)).save(captor.capture());
        return captor.getAllValues();
    }

    @Nested
    @DisplayName("createNotification")
    class CreateNotificationTests {

        @Test
        @DisplayName("stores the notification with its recipient, message, type, link and a timestamp")
        void shouldStoreEveryFieldOfTheNotification() {
            notificationService.createNotification(user, "Test message",
                    NotificationType.TASK_ASSIGNED, "/projects/PROJ");

            var saved = savedNotifications().getFirst();
            assertThat(saved.getUser()).isSameAs(user);
            assertThat(saved.getMessage()).isEqualTo("Test message");
            assertThat(saved.getType()).isEqualTo(NotificationType.TASK_ASSIGNED);
            assertThat(saved.getLink()).isEqualTo("/projects/PROJ");
            assertThat(saved.getIsRead()).isFalse();
            assertThat(saved.getTimestamp()).isNotNull();
        }

        @Test
        @DisplayName("pushes the stored notification to the recipient's own stream")
        void shouldPushTheStoredNotificationToTheRecipientStream() {
            assignIdsOnSave();

            notificationService.createNotification(user, "Test message",
                    NotificationType.PROJECT_INVITATION, "/projects/PROJ");

            var recipientId = ArgumentCaptor.forClass(Integer.class);
            var dto = ArgumentCaptor.forClass(NotificationDTO.class);
            verify(sseEmitterManager).sendNotification(recipientId.capture(), dto.capture());

            var stored = savedNotifications().getFirst();
            assertThat(recipientId.getValue()).isEqualTo(1);
            assertThat(dto.getValue().id()).isEqualTo(stored.getId());
            assertThat(dto.getValue().message()).isEqualTo("Test message");
            assertThat(dto.getValue().type()).isEqualTo(NotificationType.PROJECT_INVITATION);
            assertThat(dto.getValue().link()).isEqualTo("/projects/PROJ");
            assertThat(dto.getValue().isRead()).isFalse();
            assertThat(dto.getValue().timestamp()).isEqualTo(stored.getTimestamp());
        }

        @Test
        @DisplayName("emails the recipient when their preferences ask for that notification type")
        void shouldEmailTheRecipientWhenTheirPreferencesAllowIt() {
            var subscriber = wantingEveryEmail(7, "subscriber@example.com");

            notificationService.createNotification(subscriber, "You were assigned TASK-1",
                    NotificationType.TASK_ASSIGNED, "/projects/PROJ");

            verify(emailService).sendNotificationEmail("subscriber@example.com", "User",
                    "You were assigned TASK-1", NotificationType.TASK_ASSIGNED, "/projects/PROJ");
        }

        @Test
        @DisplayName("does not email a recipient who has that notification type switched off")
        void shouldNotEmailWhenThePreferenceIsOff() {
            var subscriber = wantingEveryEmail(7, "subscriber@example.com");
            subscriber.setEmailOnTaskAssigned(false);

            notificationService.createNotification(subscriber, "You were assigned TASK-1",
                    NotificationType.TASK_ASSIGNED, "/projects/PROJ");

            verify(sseEmitterManager).sendNotification(eq(7), any());
            verifyNoInteractions(emailService);
        }

        @Test
        @DisplayName("does not email a recipient who has email notifications disabled entirely")
        void shouldNotEmailWhenEmailsAreDisabledEntirely() {
            user.setEmailNotificationsEnabled(false);

            notificationService.createNotification(user, "You were assigned TASK-1",
                    NotificationType.TASK_ASSIGNED, "/projects/PROJ");

            verifyNoInteractions(emailService);
        }
    }

    @Nested
    @DisplayName("notifyAll")
    class NotifyAllTests {

        @Test
        @DisplayName("stores at most one notification per recipient and keeps the first entry")
        void shouldStoreOneNotificationPerRecipientKeepingTheFirstEntry() {
            var pending = List.of(
                    new NotificationService.Pending(user, "Someone replied to your comment",
                            NotificationType.COMMENT_REPLY, "/reply-link"),
                    new NotificationService.Pending(user, "New comment on task",
                            NotificationType.TASK_COMMENT, "/comment-link"),
                    new NotificationService.Pending(otherUser, "New comment on task",
                            NotificationType.TASK_COMMENT, "/comment-link"));

            notificationService.notifyAll(pending);

            var captor = ArgumentCaptor.forClass(Notification.class);
            verify(notificationRepository, times(2)).save(captor.capture());
            assertThat(captor.getAllValues())
                    .extracting(Notification::getUser, Notification::getType, Notification::getMessage)
                    .containsExactly(
                            tuple(user, NotificationType.COMMENT_REPLY, "Someone replied to your comment"),
                            tuple(otherUser, NotificationType.TASK_COMMENT, "New comment on task"));

            verify(sseEmitterManager, times(1)).sendNotification(eq(1), any());
            verify(sseEmitterManager, times(1)).sendNotification(eq(2), any());
        }

        @Test
        @DisplayName("skips null entries and recipients that have no id yet")
        void shouldSkipUnusableEntries() {
            var unsaved = TestEntityFactory.createUser(null, "unsaved@example.com");
            var pending = Arrays.asList(
                    null,
                    new NotificationService.Pending(null, "no recipient",
                            NotificationType.TASK_UPDATED, "/link"),
                    new NotificationService.Pending(unsaved, "recipient without an id",
                            NotificationType.TASK_UPDATED, "/link"),
                    new NotificationService.Pending(user, "the only usable entry",
                            NotificationType.TASK_UPDATED, "/link"));

            notificationService.notifyAll(pending);

            assertThat(savedNotifications())
                    .extracting(Notification::getUser, Notification::getMessage)
                    .containsExactly(tuple(user, "the only usable entry"));
            verify(sseEmitterManager, times(1)).sendNotification(eq(1), any());
        }

        @Test
        @DisplayName("does nothing at all for an empty or null batch")
        void shouldDoNothingForAnEmptyBatch() {
            notificationService.notifyAll(List.of());
            notificationService.notifyAll(null);

            verifyNoInteractions(notificationRepository, sseEmitterManager, emailService);
        }

        @Test
        @DisplayName("still delivers to the other recipients when one stream push blows up")
        void shouldIsolateAFailingSideEffect() {
            var firstRecipient = wantingEveryEmail(1, "first@example.com");
            var secondRecipient = wantingEveryEmail(2, "second@example.com");
            doThrow(new IllegalStateException("emitter already completed"))
                    .when(sseEmitterManager).sendNotification(eq(1), any());

            var pending = List.of(
                    new NotificationService.Pending(firstRecipient, "first message",
                            NotificationType.TASK_ASSIGNED, "/first"),
                    new NotificationService.Pending(secondRecipient, "second message",
                            NotificationType.TASK_ASSIGNED, "/second"));

            assertThatCode(() -> notificationService.notifyAll(pending)).doesNotThrowAnyException();

            // Both rows were written, and the surviving recipient still got both side effects.
            verify(notificationRepository, times(2)).save(any(Notification.class));
            verify(sseEmitterManager).sendNotification(eq(2), any());
            verify(emailService).sendNotificationEmail(eq("second@example.com"), eq("User"),
                    eq("second message"), eq(NotificationType.TASK_ASSIGNED), eq("/second"));
            // The failing recipient's own follow-up work stopped at the exception.
            verify(emailService, never()).sendNotificationEmail(eq("first@example.com"), anyString(),
                    anyString(), any(), anyString());
        }

        @Test
        @DisplayName("swallows a failing email so an already-written notification is never rolled back")
        void shouldIsolateAFailingEmail() {
            var subscriber = wantingEveryEmail(1, "subscriber@example.com");
            doThrow(new IllegalStateException("mail queue full"))
                    .when(emailService).sendNotificationEmail(anyString(), anyString(), anyString(),
                            any(), anyString());

            assertThatCode(() -> notificationService.createNotification(subscriber, "message",
                    NotificationType.TASK_ASSIGNED, "/link")).doesNotThrowAnyException();

            verify(notificationRepository).save(any(Notification.class));
            verify(sseEmitterManager).sendNotification(eq(1), any());
        }

        @Test
        @DisplayName("holds the stream push back until the surrounding transaction has committed")
        void shouldDeferSideEffectsUntilCommit() {
            TransactionSynchronizationManager.initSynchronization();

            notificationService.notifyAll(List.of(new NotificationService.Pending(
                    user, "message", NotificationType.TASK_ASSIGNED, "/link")));

            verify(notificationRepository).save(any(Notification.class));
            verifyNoInteractions(sseEmitterManager, emailService);

            var synchronizations = new ArrayList<>(TransactionSynchronizationManager.getSynchronizations());
            assertThat(synchronizations).hasSize(1);
            synchronizations.forEach(TransactionSynchronization::afterCommit);

            verify(sseEmitterManager).sendNotification(eq(1), any());
        }
    }

    @Nested
    @DisplayName("getNotifications")
    class GetNotificationsTests {

        @Test
        @DisplayName("maps the page of entities to DTOs and keeps the paging metadata")
        void shouldReturnAPageOfDtos() {
            var first = TestEntityFactory.createNotification(11, user);
            first.setLink("/projects?selectedIssue=PROJ-1");
            var second = TestEntityFactory.createNotification(12, user);
            second.setType(NotificationType.COMMENT_REPLY);
            second.setIsRead(true);
            Pageable pageable = PageRequest.of(1, 2);
            when(notificationRepository.findByUserIdOrderByTimestampDescIdDesc(1, pageable))
                    .thenReturn(new PageImpl<>(List.of(first, second), pageable, 7));

            var page = notificationService.getNotifications(1, pageable);

            assertThat(page.getTotalElements()).isEqualTo(7);
            assertThat(page.getNumber()).isEqualTo(1);
            assertThat(page.getContent())
                    .extracting(NotificationDTO::id, NotificationDTO::message, NotificationDTO::type,
                            NotificationDTO::isRead, NotificationDTO::link)
                    .containsExactly(
                            tuple(11, "Notification 11", NotificationType.TASK_ASSIGNED, false,
                                    "/projects?selectedIssue=PROJ-1"),
                            tuple(12, "Notification 12", NotificationType.COMMENT_REPLY, true, null));
            assertThat(page.getContent().getFirst().timestamp()).isEqualTo(first.getTimestamp());
        }

        @Test
        @DisplayName("returns an empty page rather than null when the user has no notifications")
        void shouldReturnAnEmptyPage() {
            Pageable pageable = PageRequest.of(0, 20);
            when(notificationRepository.findByUserIdOrderByTimestampDescIdDesc(1, pageable))
                    .thenReturn(new PageImpl<>(List.of(), pageable, 0));

            assertThat(notificationService.getNotifications(1, pageable)).isEmpty();
        }
    }

    @Nested
    @DisplayName("markNotificationsAsRead")
    class MarkNotificationsAsReadTests {

        private Collection<Integer> captureCollection(String method) {
            ArgumentCaptor<Collection<Integer>> captor = ArgumentCaptor.captor();
            if ("countOwnedBy".equals(method)) {
                verify(notificationRepository).countOwnedBy(captor.capture(), eq(1));
            } else {
                verify(notificationRepository).markReadForUser(captor.capture(), eq(1));
            }
            return captor.getValue();
        }

        @Test
        @DisplayName("flips the read flag for the caller's own notifications in one statement")
        void shouldMarkOwnedNotificationsAsRead() {
            when(notificationRepository.countOwnedBy(anyCollection(), eq(1))).thenReturn(2L);

            notificationService.markNotificationsAsRead(List.of(11, 12), 1);

            assertThat(captureCollection("countOwnedBy")).containsExactly(11, 12);
            assertThat(captureCollection("markReadForUser")).containsExactly(11, 12);
        }

        @Test
        @DisplayName("refuses the whole batch when any id belongs to somebody else")
        void shouldRefuseTheBatchWhenAnyIdIsNotOwned() {
            // Only one of the two ids is owned by user 1.
            when(notificationRepository.countOwnedBy(anyCollection(), eq(1))).thenReturn(1L);

            assertThatThrownBy(() -> notificationService.markNotificationsAsRead(List.of(11, 12), 1))
                    .isInstanceOf(AuthorizationException.class)
                    .hasMessageContaining("Access denied");

            verify(notificationRepository, never()).markReadForUser(anyCollection(), any());
        }

        @Test
        @DisplayName("refuses ids that do not exist at all")
        void shouldRefuseIdsThatDoNotExist() {
            when(notificationRepository.countOwnedBy(anyCollection(), eq(1))).thenReturn(0L);

            assertThatThrownBy(() -> notificationService.markNotificationsAsRead(List.of(999), 1))
                    .isInstanceOf(AuthorizationException.class);

            verify(notificationRepository, never()).markReadForUser(anyCollection(), any());
        }

        @Test
        @DisplayName("collapses repeated ids before counting them, so duplicates are not a mismatch")
        void shouldDeduplicateIdsBeforeTheOwnershipCheck() {
            // Two distinct ids owned; without de-duplication the count (2) would not match the
            // four submitted ids and the caller would be rejected for their own notifications.
            when(notificationRepository.countOwnedBy(anyCollection(), eq(1))).thenReturn(2L);

            notificationService.markNotificationsAsRead(List.of(12, 11, 12, 11), 1);

            assertThat(captureCollection("countOwnedBy")).containsExactly(12, 11);
            assertThat(captureCollection("markReadForUser")).containsExactly(12, 11);
        }

        @Test
        @DisplayName("drops null ids from the batch")
        void shouldDropNullIds() {
            when(notificationRepository.countOwnedBy(anyCollection(), eq(1))).thenReturn(1L);

            notificationService.markNotificationsAsRead(Arrays.asList(11, null, 11), 1);

            assertThat(captureCollection("countOwnedBy")).containsExactly(11);
            assertThat(captureCollection("markReadForUser")).containsExactly(11);
        }

        @Test
        @DisplayName("touches the database for neither an empty, a null, nor an all-null list")
        void shouldNoOpForListsWithNothingToUpdate() {
            assertThatCode(() -> {
                notificationService.markNotificationsAsRead(List.of(), 1);
                notificationService.markNotificationsAsRead(null, 1);
                notificationService.markNotificationsAsRead(Arrays.asList(null, null), 1);
            }).doesNotThrowAnyException();

            verifyNoInteractions(notificationRepository);
        }
    }

    @Nested
    @DisplayName("markAllNotificationsAsRead")
    class MarkAllNotificationsAsReadTests {

        @Test
        @DisplayName("flips every unread notification for the caller in one statement")
        void shouldMarkEveryUnreadNotificationAsRead() {
            when(notificationRepository.countByUserIdAndIsReadFalse(1)).thenReturn(0L);

            notificationService.markAllNotificationsAsRead(1);

            verify(notificationRepository).markAllReadForUser(1);
        }

        @Test
        @DisplayName("returns the authoritative remaining unread count from the database")
        void shouldReturnTheRemainingUnreadCount() {
            // Simulates a notification landing between the bulk update and the recount.
            when(notificationRepository.countByUserIdAndIsReadFalse(1)).thenReturn(1L);

            var remaining = notificationService.markAllNotificationsAsRead(1);

            assertThat(remaining).isEqualTo(1L);
        }

        @Test
        @DisplayName("only ever touches the caller's own notifications")
        void shouldScopeToTheCallersOwnNotifications() {
            when(notificationRepository.countByUserIdAndIsReadFalse(2)).thenReturn(0L);

            notificationService.markAllNotificationsAsRead(2);

            verify(notificationRepository).markAllReadForUser(2);
            verify(notificationRepository, never()).markAllReadForUser(1);
        }
    }
}
