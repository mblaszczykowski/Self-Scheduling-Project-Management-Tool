package com.backend.services;

import com.backend.TestEntityFactory;
import com.backend.entities.Notification;
import com.backend.entities.NotificationType;
import com.backend.entities.User;
import com.backend.exception.AuthorizationException;
import com.backend.repositories.NotificationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationRepository notificationRepository;

    private NotificationService notificationService;

    private User user;
    private User otherUser;

    @BeforeEach
    void setUp() {
        notificationService = new NotificationService(notificationRepository);
        user = TestEntityFactory.createUser(1, "user@example.com");
        otherUser = TestEntityFactory.createUser(2, "other@example.com");
    }

    @Nested
    @DisplayName("createNotification")
    class CreateNotificationTests {

        @Test
        @DisplayName("should create notification with all fields")
        void shouldCreateNotificationWithAllFields() {
            notificationService.createNotification(user, "Test message",
                    NotificationType.TASK_ASSIGNED, "/projects/PROJ");

            var captor = ArgumentCaptor.forClass(Notification.class);
            verify(notificationRepository).save(captor.capture());

            var saved = captor.getValue();
            assertEquals(user, saved.getUser());
            assertEquals("Test message", saved.getMessage());
            assertEquals(NotificationType.TASK_ASSIGNED, saved.getType());
            assertEquals("/projects/PROJ", saved.getLink());
            assertNotNull(saved.getTimestamp());
        }

        @Test
        @DisplayName("should create notifications with different types")
        void shouldCreateNotificationsWithDifferentTypes() {
            notificationService.createNotification(user, "Invited",
                    NotificationType.PROJECT_INVITATION, "/projects/P");

            var captor = ArgumentCaptor.forClass(Notification.class);
            verify(notificationRepository).save(captor.capture());
            assertEquals(NotificationType.PROJECT_INVITATION, captor.getValue().getType());
        }
    }

    @Nested
    @DisplayName("markNotificationsAsRead")
    class MarkNotificationsAsReadTests {

        @Test
        @DisplayName("should mark owned notifications as read")
        void shouldMarkOwnedNotificationsAsRead() {
            var n1 = TestEntityFactory.createNotification(1, user);
            var n2 = TestEntityFactory.createNotification(2, user);

            when(notificationRepository.findAllById(List.of(1, 2))).thenReturn(List.of(n1, n2));

            notificationService.markNotificationsAsRead(List.of(1, 2), 1);

            assertTrue(n1.getIsRead());
            assertTrue(n2.getIsRead());
            verify(notificationRepository).saveAll(List.of(n1, n2));
        }

        @Test
        @DisplayName("should throw when marking other user's notification")
        void shouldThrowWhenMarkingOtherUsersNotification() {
            var ownNotification = TestEntityFactory.createNotification(1, user);
            var otherNotification = TestEntityFactory.createNotification(2, otherUser);

            when(notificationRepository.findAllById(List.of(1, 2)))
                    .thenReturn(List.of(ownNotification, otherNotification));

            assertThrows(AuthorizationException.class, () ->
                    notificationService.markNotificationsAsRead(List.of(1, 2), 1));
        }

        @Test
        @DisplayName("should handle empty notification list")
        void shouldHandleEmptyList() {
            when(notificationRepository.findAllById(List.of())).thenReturn(List.of());

            assertDoesNotThrow(() ->
                    notificationService.markNotificationsAsRead(List.of(), 1));

            verify(notificationRepository).saveAll(List.of());
        }
    }

    @Nested
    @DisplayName("convertToDTO")
    class ConvertToDTOTests {

        @Test
        @DisplayName("should convert notification to DTO with all fields")
        void shouldConvertToDTO() {
            var notification = TestEntityFactory.createNotification(1, user);
            notification.setLink("/projects/PROJ");

            var dto = notificationService.convertToDTO(notification);

            assertEquals(1, dto.id());
            assertEquals("Notification 1", dto.message());
            assertNotNull(dto.timestamp());
            assertFalse(dto.isRead());
            assertEquals(NotificationType.TASK_ASSIGNED, dto.type());
            assertEquals("/projects/PROJ", dto.link());
        }

        @Test
        @DisplayName("should convert read notification")
        void shouldConvertReadNotification() {
            var notification = TestEntityFactory.createNotification(1, user);
            notification.setIsRead(true);

            var dto = notificationService.convertToDTO(notification);

            assertTrue(dto.isRead());
        }
    }
}
