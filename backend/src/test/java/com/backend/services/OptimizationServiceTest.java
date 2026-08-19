package com.backend.services;

import com.backend.config.AppProperties;
import com.backend.dtos.OptimizationResultDTO;
import com.backend.dtos.TaskDTO;
import com.backend.dtos.TaskScheduleSuggestionDTO;
import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.requests.ApplyOptimizationRequest;
import com.backend.requests.OptimizationRequest;
import com.backend.scheduling.SchedulingService;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OptimizationServiceTest {
    private static final Integer USER_ID = 7;
    private static final LocalDate TODAY = LocalDate.now();

    @Mock private OptimizationInputLoader inputLoader;
    @Mock private TaskService taskService;

    private OptimizationService optimization;

    @BeforeEach
    void setUp() {
        var properties = new AppProperties();
        optimization = new OptimizationService(inputLoader, taskService,
                new SchedulingService(properties), properties);
    }

    private static TaskDTO task(String key, String start, String due, String assignee,
                                List<String> dependsOn) {
        return new TaskDTO(null, null, key, "P", key, null, TaskStatus.TODO,
                LocalDate.parse(start), LocalDate.parse(due), assignee, List.of(), dependsOn,
                null, null, List.of(), null, null, 0, TaskPriority.MEDIUM);
    }

    private static TaskDTO fixedTask(String key, String start, String due, String assignee) {
        return new TaskDTO(null, null, key, "P", key, null, TaskStatus.DONE,
                LocalDate.parse(start), LocalDate.parse(due), assignee, List.of(), List.of(),
                null, null, List.of(), null, null, 100, TaskPriority.MEDIUM);
    }

    private static TaskDTO datelessTask(String key) {
        return new TaskDTO(null, null, key, "P", key, null, TaskStatus.TODO, null, null, null,
                List.of(), List.of(), null, null, List.of(), null, null, 0, TaskPriority.MEDIUM);
    }

    private List<TaskDTO> doubleBookedPair() {
        var day = TODAY.plusDays(1).toString();
        var end = TODAY.plusDays(6).toString();
        return List.of(
                task("P-1", day, end, "dev@x", List.of()),
                task("P-2", day, end, "dev@x", List.of()));
    }

    private ApplyOptimizationRequest applyRequest(List<String> acceptedKeys) {
        return new ApplyOptimizationRequest(List.of("P"), null, null, null, acceptedKeys);
    }

    private static OptimizationRequest simulateRequest() {
        return new OptimizationRequest(List.of("P"), null, null, null);
    }

    private static TaskScheduleSuggestionDTO suggestionFor(OptimizationResultDTO result, String taskKey) {
        return result.suggestions().stream()
                .filter(s -> s.taskKey().equals(taskKey))
                .findFirst()
                .orElseThrow();
    }

    @Nested
    @DisplayName("What gets written")
    class Writes {
        @Test
        @DisplayName("a plan that changes nothing writes nothing")
        void unchangedPlanWritesNothing() {
            var tasks = List.of(task("P-1", TODAY.plusDays(1).toString(),
                    TODAY.plusDays(3).toString(), "dev@x", List.of()));
            when(inputLoader.load(List.of("P"), USER_ID))
                    .thenReturn(new OptimizationInputLoader.Input(tasks, List.of()));

            assertThat(optimization.apply(applyRequest(null), USER_ID)).isZero();
            verify(taskService, never()).applySchedule(any(), anyInt());
        }

        @Test
        @DisplayName("accepting the whole plan writes exactly the tasks that moved, with concrete non-overlapping dates")
        void acceptingEverythingWritesTheMovedTasks() {
            var tasks = doubleBookedPair();
            when(inputLoader.load(List.of("P"), USER_ID))
                    .thenReturn(new OptimizationInputLoader.Input(tasks, List.of()));
            when(taskService.applySchedule(any(), anyInt())).thenReturn(1);

            optimization.apply(applyRequest(List.of("P-1", "P-2")), USER_ID);

            @SuppressWarnings("unchecked")
            ArgumentCaptor<List<TaskService.ScheduleChange>> captor =
                    ArgumentCaptor.forClass(List.class);
            verify(taskService).applySchedule(captor.capture(), anyInt());
            var changes = captor.getValue();
            assertThat(changes).allSatisfy(change -> assertThat(change.taskKey()).isIn("P-1", "P-2"));

            var originalDue = TODAY.plusDays(6);
            assertThat(changes).extracting(TaskService.ScheduleChange::taskKey).containsExactly("P-2");

            var moved = changes.get(0);
            assertThat(moved.startDate()).isEqualTo(originalDue.plusDays(1));
            assertThat(moved.dueDate()).isEqualTo(originalDue.plusDays(6));

            assertThat(moved.startDate()).isAfter(originalDue);
        }
    }

    @Nested
    @DisplayName("A preview that no longer matches the board")
    class StalePreview {
        @Test
        @DisplayName("is refused rather than applied in part")
        void partialAcceptanceOfAFreshPlanIsRefused() {
            var tasks = doubleBookedPair();
            when(inputLoader.load(List.of("P"), USER_ID))
                    .thenReturn(new OptimizationInputLoader.Input(tasks, List.of()));

            assertThatThrownBy(() -> optimization.apply(applyRequest(List.of("P-1")), USER_ID))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("changed");

            verify(taskService, never()).applySchedule(any(), anyInt());
        }

        @Test
        @DisplayName("an empty accepted list still means the whole plan, not nothing")
        void emptyAcceptedListMeansEverything() {
            var tasks = doubleBookedPair();
            when(inputLoader.load(List.of("P"), USER_ID))
                    .thenReturn(new OptimizationInputLoader.Input(tasks, List.of()));
            when(taskService.applySchedule(any(), anyInt())).thenReturn(1);

            optimization.apply(applyRequest(List.of()), USER_ID);

            verify(taskService).applySchedule(any(), anyInt());
        }
    }

    @Test
    @DisplayName("a project the caller cannot reach never reaches the scheduler")
    void inaccessibleProjectIsRefusedByTheLoader() {
        when(inputLoader.load(List.of("P"), USER_ID))
                .thenThrow(new ResourceNotFoundException("Project not found"));

        assertThatThrownBy(() -> optimization.apply(applyRequest(null), USER_ID))
                .isInstanceOf(ResourceNotFoundException.class);

        verify(taskService, never()).applySchedule(any(), anyInt());
    }

    @Nested
    @DisplayName("simulate()")
    class Simulate {
        @Test
        @DisplayName("flags the task that moved, leaves the untouched one unflagged, "
                + "excludes fixed work, and reports the dateless task as skipped")
        void reportsShiftedUntouchedFixedAndDatelessTasksCorrectly() {
            var day = TODAY.plusDays(1);
            var end = TODAY.plusDays(6);
            var tasks = List.of(
                    task("P-1", day.toString(), end.toString(), "dev@x", List.of()),
                    task("P-2", day.toString(), end.toString(), "dev@x", List.of()),
                    fixedTask("P-3", TODAY.minusDays(10).toString(), TODAY.minusDays(5).toString(), "dev@x"),
                    datelessTask("P-4"));
            when(inputLoader.load(List.of("P"), USER_ID))
                    .thenReturn(new OptimizationInputLoader.Input(tasks, List.of()));

            var result = optimization.simulate(simulateRequest(), USER_ID);

            assertThat(result.skippedTaskKeys()).containsExactly("P-4");
            assertThat(result.suggestions()).extracting(TaskScheduleSuggestionDTO::taskKey)
                    .containsExactlyInAnyOrder("P-1", "P-2");

            var unchanged = suggestionFor(result, "P-1");
            assertThat(unchanged.wasShifted()).isFalse();
            assertThat(unchanged.originalStartDate()).isEqualTo(day);
            assertThat(unchanged.originalDueDate()).isEqualTo(end);
            assertThat(unchanged.suggestedStartDate()).isEqualTo(day);
            assertThat(unchanged.suggestedDueDate()).isEqualTo(end);

            var moved = suggestionFor(result, "P-2");
            assertThat(moved.wasShifted()).isTrue();
            assertThat(moved.originalStartDate()).isEqualTo(day);
            assertThat(moved.originalDueDate()).isEqualTo(end);
            assertThat(moved.suggestedStartDate()).isEqualTo(end.plusDays(1));
            assertThat(moved.suggestedDueDate()).isEqualTo(end.plusDays(6));

            assertThat(result.originalMetrics().totalTasks()).isEqualTo(2);
            assertThat(result.originalMetrics().resourceConflicts()).isPositive();
            assertThat(result.originalMetrics().feasible()).isFalse();
            assertThat(result.optimizedMetrics().totalTasks()).isEqualTo(2);
            assertThat(result.optimizedMetrics().resourceConflicts()).isZero();
            assertThat(result.optimizedMetrics().feasible()).isTrue();
        }
    }
}
