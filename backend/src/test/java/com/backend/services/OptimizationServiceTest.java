package com.backend.services;

import com.backend.config.AppProperties;
import com.backend.dtos.TaskDTO;
import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.requests.ApplyOptimizationRequest;
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

/**
 * The apply path — the only place the optimizer writes to the board.
 *
 * <p>Uses a real {@link SchedulingService}, because what is being tested is precisely the
 * agreement between the schedule the scheduler derives and the subset the caller approved. A
 * stubbed scheduler would let the test agree with itself.
 */
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
                null, List.of(), null, null, 0, TaskPriority.MEDIUM);
    }

    /** Two tasks on one person, booked over each other, so any schedule has to move one. */
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

    @Nested
    @DisplayName("What gets written")
    class Writes {

        @Test
        @DisplayName("a plan that changes nothing writes nothing")
        void unchangedPlanWritesNothing() {
            // One task, sole owner of its assignee: the optimizer has nothing to improve.
            var tasks = List.of(task("P-1", TODAY.plusDays(1).toString(),
                    TODAY.plusDays(3).toString(), "dev@x", List.of()));
            when(inputLoader.load(List.of("P"), USER_ID))
                    .thenReturn(new OptimizationInputLoader.Input(tasks, List.of()));

            assertThat(optimization.apply(applyRequest(null), USER_ID)).isZero();
            verify(taskService, never()).applySchedule(any(), anyInt());
        }

        @Test
        @DisplayName("accepting the whole plan writes exactly the tasks that moved")
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
            assertThat(captor.getValue()).isNotEmpty();
            assertThat(captor.getValue()).allSatisfy(change ->
                    assertThat(change.taskKey()).isIn("P-1", "P-2"));
        }
    }

    @Nested
    @DisplayName("A preview that no longer matches the board")
    class StalePreview {

        /**
         * The endpoint re-derives the schedule instead of trusting dates from the browser, so the
         * dates it writes are always fresh. The <em>set</em> of accepted keys is not: it comes
         * from a preview that may predate an edit. Writing only the part of a fresh plan that the
         * caller happens to have seen persists half a schedule, and the half left behind is what
         * made the other half feasible — which is exactly the silently-infeasible write the
         * re-derivation exists to prevent.
         */
        @Test
        @DisplayName("is refused rather than applied in part")
        void partialAcceptanceOfAFreshPlanIsRefused() {
            var tasks = doubleBookedPair();
            when(inputLoader.load(List.of("P"), USER_ID))
                    .thenReturn(new OptimizationInputLoader.Input(tasks, List.of()));

            // The caller approved P-1 only; the current plan also needs P-2 to move.
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
}
