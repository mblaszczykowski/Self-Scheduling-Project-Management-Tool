package com.backend.services;

import com.backend.TestEntityFactory;
import com.backend.entities.Task;
import com.backend.entities.TaskActivity;
import com.backend.entities.TaskActivityType;
import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;
import com.backend.entities.User;
import com.backend.mapper.EntityMapper;
import com.backend.repositories.TaskActivityRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@DisplayName("TaskActivityService")
class TaskActivityServiceTest {

    @Mock
    private TaskActivityRepository taskActivityRepository;

    private TaskActivityService taskActivityService;
    private Task task;
    private User author;

    @BeforeEach
    void setUp() {
        taskActivityService = new TaskActivityService(taskActivityRepository, new EntityMapper());
        var owner = TestEntityFactory.createUser(1, "owner@example.com");
        var project = TestEntityFactory.createProject(1, "PROJ", owner);
        task = TestEntityFactory.createTask(100, 1, project);
        author = TestEntityFactory.createUser(2, "author@example.com");
    }

    private static final class Snap {
        TaskStatus status = TaskStatus.TODO;
        TaskPriority priority = TaskPriority.MEDIUM;
        String assignee = null;
        Integer progress = 0;
        LocalDate startDate = LocalDate.of(2026, 1, 5);
        LocalDate dueDate = LocalDate.of(2026, 1, 9);
        String summary = "Write the report";
        String description = "Chapter five";
        List<String> labels = List.of();
        List<String> dependencyKeys = List.of();
        List<String> attachments = List.of();

        TaskSnapshot build() {
            return new TaskSnapshot(status, priority, assignee, progress, startDate, dueDate,
                    summary, description, labels, dependencyKeys, attachments);
        }
    }

    private List<TaskActivity> loggedActivities() {
        var captor = ArgumentCaptor.forClass(TaskActivity.class);
        verify(taskActivityRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
        return captor.getAllValues();
    }

    @Nested
    @DisplayName("logFieldChanges")
    class LogFieldChanges {

        @Test
        @DisplayName("logs nothing when nothing changed")
        void logsNothingWhenNothingChanged() {
            var before = new Snap().build();
            var after = new Snap().build();

            taskActivityService.logFieldChanges(task, author, before, after);

            verify(taskActivityRepository, never()).save(any());
        }

        @Test
        @DisplayName("logs a status change with the old and new values")
        void logsAStatusChange() {
            var before = new Snap().build();
            var afterSnap = new Snap();
            afterSnap.status = TaskStatus.DONE;

            taskActivityService.logFieldChanges(task, author, before, afterSnap.build());

            var activities = loggedActivities();
            assertThat(activities).hasSize(1);
            assertThat(activities.getFirst().getType()).isEqualTo(TaskActivityType.STATUS_CHANGED);
            assertThat(activities.getFirst().getFieldName()).isEqualTo("status");
            assertThat(activities.getFirst().getOldValue()).isEqualTo("TODO");
            assertThat(activities.getFirst().getNewValue()).isEqualTo("DONE");
        }

        @Test
        @DisplayName("logs a priority change")
        void logsAPriorityChange() {
            var before = new Snap().build();
            var afterSnap = new Snap();
            afterSnap.priority = TaskPriority.HIGHEST;

            taskActivityService.logFieldChanges(task, author, before, afterSnap.build());

            var activities = loggedActivities();
            assertThat(activities).hasSize(1);
            assertThat(activities.getFirst().getType()).isEqualTo(TaskActivityType.PRIORITY_CHANGED);
            assertThat(activities.getFirst().getOldValue()).isEqualTo("MEDIUM");
            assertThat(activities.getFirst().getNewValue()).isEqualTo("HIGHEST");
        }

        @Test
        @DisplayName("logs an assignee change from unassigned to a named person")
        void logsAnAssigneeChange() {
            var before = new Snap().build();
            var afterSnap = new Snap();
            afterSnap.assignee = "Jane Doe";

            taskActivityService.logFieldChanges(task, author, before, afterSnap.build());

            var activities = loggedActivities();
            assertThat(activities).hasSize(1);
            assertThat(activities.getFirst().getType()).isEqualTo(TaskActivityType.ASSIGNEE_CHANGED);
            assertThat(activities.getFirst().getOldValue()).isNull();
            assertThat(activities.getFirst().getNewValue()).isEqualTo("Jane Doe");
        }

        @Test
        @DisplayName("logs a progress change as text")
        void logsAProgressChange() {
            var before = new Snap().build();
            var afterSnap = new Snap();
            afterSnap.progress = 80;

            taskActivityService.logFieldChanges(task, author, before, afterSnap.build());

            var activities = loggedActivities();
            assertThat(activities).hasSize(1);
            assertThat(activities.getFirst().getType()).isEqualTo(TaskActivityType.PROGRESS_CHANGED);
            assertThat(activities.getFirst().getOldValue()).isEqualTo("0");
            assertThat(activities.getFirst().getNewValue()).isEqualTo("80");
        }

        @Test
        @DisplayName("logs a date change formatted as an arrow between the two dates")
        void logsADatesChange() {
            var before = new Snap().build();
            var afterSnap = new Snap();
            afterSnap.dueDate = LocalDate.of(2026, 1, 20);

            taskActivityService.logFieldChanges(task, author, before, afterSnap.build());

            var activities = loggedActivities();
            assertThat(activities).hasSize(1);
            assertThat(activities.getFirst().getType()).isEqualTo(TaskActivityType.DATES_CHANGED);
            assertThat(activities.getFirst().getOldValue()).isEqualTo("2026-01-05 → 2026-01-09");
            assertThat(activities.getFirst().getNewValue()).isEqualTo("2026-01-05 → 2026-01-20");
        }

        @Test
        @DisplayName("logs a summary change verbatim")
        void logsASummaryChange() {
            var before = new Snap().build();
            var afterSnap = new Snap();
            afterSnap.summary = "Renamed";

            taskActivityService.logFieldChanges(task, author, before, afterSnap.build());

            var activities = loggedActivities();
            assertThat(activities).hasSize(1);
            assertThat(activities.getFirst().getType()).isEqualTo(TaskActivityType.SUMMARY_CHANGED);
            assertThat(activities.getFirst().getOldValue()).isEqualTo("Write the report");
            assertThat(activities.getFirst().getNewValue()).isEqualTo("Renamed");
        }

        @Test
        @DisplayName("logs a description change as a character count, not the full text")
        void logsADescriptionChangeAsALengthMarker() {
            var before = new Snap().build();
            var afterSnap = new Snap();
            afterSnap.description = "A completely different, and much longer, description of the work.";

            taskActivityService.logFieldChanges(task, author, before, afterSnap.build());

            var activities = loggedActivities();
            assertThat(activities).hasSize(1);
            assertThat(activities.getFirst().getType()).isEqualTo(TaskActivityType.DESCRIPTION_CHANGED);
            assertThat(activities.getFirst().getOldValue()).isEqualTo("Chapter five".length() + " characters");
            assertThat(activities.getFirst().getNewValue())
                    .isEqualTo(afterSnap.description.length() + " characters");
        }

        @Test
        @DisplayName("does not log a description edit that happens to keep the same length")
        void doesNotDetectASameLengthDescriptionEdit() {
            var before = new Snap();
            before.description = "Twelve chars";
            var after = new Snap();
            after.description = "Swapped Word";

            taskActivityService.logFieldChanges(task, author, before.build(), after.build());

            verify(taskActivityRepository, never()).save(any());
        }

        @Test
        @DisplayName("logs a labels change as a joined list")
        void logsALabelsChange() {
            var before = new Snap().build();
            var afterSnap = new Snap();
            afterSnap.labels = List.of("bug", "urgent");

            taskActivityService.logFieldChanges(task, author, before, afterSnap.build());

            var activities = loggedActivities();
            assertThat(activities).hasSize(1);
            assertThat(activities.getFirst().getType()).isEqualTo(TaskActivityType.LABELS_CHANGED);
            assertThat(activities.getFirst().getOldValue()).isNull();
            assertThat(activities.getFirst().getNewValue()).isEqualTo("bug, urgent");
        }

        @Test
        @DisplayName("logs a dependencies change as a joined list")
        void logsADependenciesChange() {
            var before = new Snap().build();
            var afterSnap = new Snap();
            afterSnap.dependencyKeys = List.of("PROJ-2", "PROJ-3");

            taskActivityService.logFieldChanges(task, author, before, afterSnap.build());

            var activities = loggedActivities();
            assertThat(activities).hasSize(1);
            assertThat(activities.getFirst().getType()).isEqualTo(TaskActivityType.DEPENDENCIES_CHANGED);
            assertThat(activities.getFirst().getNewValue()).isEqualTo("PROJ-2, PROJ-3");
        }

        @Test
        @DisplayName("logs an attachments change as a file count")
        void logsAnAttachmentsChange() {
            var before = new Snap().build();
            var afterSnap = new Snap();
            afterSnap.attachments = List.of("/files/a.pdf");

            taskActivityService.logFieldChanges(task, author, before, afterSnap.build());

            var activities = loggedActivities();
            assertThat(activities).hasSize(1);
            assertThat(activities.getFirst().getType()).isEqualTo(TaskActivityType.ATTACHMENTS_CHANGED);
            assertThat(activities.getFirst().getOldValue()).isNull();
            assertThat(activities.getFirst().getNewValue()).isEqualTo("1 file");
        }

        @Test
        @DisplayName("logs one row per field when several change at once")
        void logsOneRowPerChangedField() {
            var before = new Snap().build();
            var afterSnap = new Snap();
            afterSnap.status = TaskStatus.DONE;
            afterSnap.progress = 100;

            taskActivityService.logFieldChanges(task, author, before, afterSnap.build());

            var activities = loggedActivities();
            assertThat(activities).extracting(TaskActivity::getType)
                    .containsExactlyInAnyOrder(TaskActivityType.STATUS_CHANGED, TaskActivityType.PROGRESS_CHANGED);
        }

        @Test
        @DisplayName("does nothing when the author is null")
        void doesNothingWhenAuthorIsNull() {
            var before = new Snap().build();
            var afterSnap = new Snap();
            afterSnap.status = TaskStatus.DONE;

            taskActivityService.logFieldChanges(task, null, before, afterSnap.build());

            verify(taskActivityRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("logCreated / logCommentAdded / logCommentEdited / logCommentDeleted")
    class SimpleEvents {

        @Test
        @DisplayName("logCreated writes a single CREATED row with no field or values")
        void logCreatedWritesACreatedRow() {
            taskActivityService.logCreated(task, author);

            var activities = loggedActivities();
            assertThat(activities).hasSize(1);
            assertThat(activities.getFirst().getType()).isEqualTo(TaskActivityType.CREATED);
            assertThat(activities.getFirst().getFieldName()).isNull();
            assertThat(activities.getFirst().getTask()).isSameAs(task);
            assertThat(activities.getFirst().getAuthor()).isSameAs(author);
        }

        @Test
        @DisplayName("logCommentAdded writes a single COMMENT_ADDED row")
        void logCommentAddedWritesACommentAddedRow() {
            taskActivityService.logCommentAdded(task, author);

            assertThat(loggedActivities().getFirst().getType()).isEqualTo(TaskActivityType.COMMENT_ADDED);
        }

        @Test
        @DisplayName("logCommentEdited writes a single COMMENT_EDITED row")
        void logCommentEditedWritesACommentEditedRow() {
            taskActivityService.logCommentEdited(task, author);

            assertThat(loggedActivities().getFirst().getType()).isEqualTo(TaskActivityType.COMMENT_EDITED);
        }

        @Test
        @DisplayName("logCommentDeleted writes a single COMMENT_DELETED row")
        void logCommentDeletedWritesACommentDeletedRow() {
            taskActivityService.logCommentDeleted(task, author);

            assertThat(loggedActivities().getFirst().getType()).isEqualTo(TaskActivityType.COMMENT_DELETED);
        }
    }
}
