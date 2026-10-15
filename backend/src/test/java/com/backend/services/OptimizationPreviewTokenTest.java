package com.backend.services;

import com.backend.config.AppProperties;
import com.backend.dtos.TaskDTO;
import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;
import com.backend.exception.ValidationException;
import com.backend.requests.ApplyOptimizationRequest;
import com.backend.requests.OptimizationRequest;
import com.backend.scheduling.SchedulingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class OptimizationPreviewTokenTest {
    private final LocalDate today = LocalDate.now();
    private final OptimizationInputLoader loader = mock(OptimizationInputLoader.class);
    private final TaskService taskService = mock(TaskService.class);
    private OptimizationService service;
    private TaskDTO original;

    @BeforeEach
    void setUp() {
        var config = new AppProperties();
        service = new OptimizationService(loader, taskService, new SchedulingService(config), config);
        original = task("P-1", "Summary", "Description", "user@example.com", TaskStatus.TODO,
                TaskPriority.MEDIUM, 50, today, today.plusDays(4), List.of());
        input(original);
    }

    @ParameterizedTest
    @ValueSource(strings = {"key", "summary", "description", "assignee", "status", "priority", "progress", "start", "due", "dependencies"})
    void changingPreviewedInputsInvalidatesTheTokenEvenWhenTheTaskKeysStillMatch(String field) {
        var token = preview();
        input(task(field.equals("key") ? "P-2" : "P-1",
                field.equals("summary") ? "Different summary" : original.summary(),
                field.equals("description") ? "Different description" : original.description(),
                field.equals("assignee") ? "other@example.com" : original.assignee(),
                field.equals("status") ? TaskStatus.IN_PROGRESS : original.status(),
                field.equals("priority") ? TaskPriority.HIGH : original.priority(),
                field.equals("progress") ? 60 : original.progress(),
                field.equals("start") ? today.plusDays(1) : original.startDate(),
                field.equals("due") ? today.plusDays(6) : original.dueDate(),
                field.equals("dependencies") ? List.of("OUT-1") : original.dependencyKeys()));

        assertThat(preview()).isNotEqualTo(token);
        assertThatThrownBy(() -> service.apply(new ApplyOptimizationRequest(List.of("P"),
                null, null, today, List.of("P-1", "P-2"), token), 7))
                .isInstanceOf(ValidationException.class).hasMessageContaining("changed since it was previewed");
        verifyNoInteractions(taskService);
    }

    @Test
    void anUnchangedPreviewCanBeAppliedAndHasAStableToken() {
        var token = preview();
        assertThat(token).matches("[a-f0-9]{64}").isEqualTo(preview());
        assertThat(service.apply(new ApplyOptimizationRequest(List.of("P"), null, null,
                today, List.of("P-1"), token), 7)).isZero();
    }

    @Test
    void changingWeightsOrHorizonInvalidatesThePreview() {
        var token = preview();
        assertThat(service.simulate(new OptimizationRequest(List.of("P"), 0.1, 0.9, today), 7).previewToken())
                .isNotEqualTo(token);
        assertThat(service.simulate(new OptimizationRequest(List.of("P"), null, null, today.plusDays(1)), 7).previewToken())
                .isNotEqualTo(token);
    }

    private String preview() {
        return service.simulate(new OptimizationRequest(List.of("P"), null, null, today), 7).previewToken();
    }

    private void input(TaskDTO task) {
        when(loader.load(any(), eq(7))).thenReturn(new OptimizationInputLoader.Input(List.of(task), List.of(
                task("OUT-1", "Anchor", null, null, TaskStatus.DONE, TaskPriority.MEDIUM, 100,
                        today.minusDays(3), today.minusDays(1), List.of()))));
    }

    private TaskDTO task(String key, String summary, String description, String assignee,
                         TaskStatus status, TaskPriority priority, int progress,
                         LocalDate start, LocalDate due, List<String> dependencies) {
        return new TaskDTO(1, 1, key, "P", summary, description, status, start, due,
                assignee, List.of(), dependencies, null, null, List.of(), null, null, progress, priority);
    }
}
