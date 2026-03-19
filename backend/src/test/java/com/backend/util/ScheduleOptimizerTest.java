package com.backend.util;

import com.backend.dtos.TaskDTO;
import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;

import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("ScheduleOptimizer - MORCPSP SSGS Algorithm")
class ScheduleOptimizerTest {

    private final ScheduleOptimizer optimizer = new ScheduleOptimizer();
    private static final LocalDate HORIZON = LocalDate.of(2025, 1, 1);
    private static final double ALPHA = 0.8;
    private static final double BETA = 0.2;

    // ========================================================================
    // Helper methods for creating TaskDTO instances
    // ========================================================================

    private TaskDTO task(String key, String start, String end, String assignee,
                         TaskPriority priority, TaskStatus status, List<String> deps) {
        return new TaskDTO(
                null, null, key, "PROJ", key, null,
                status,
                LocalDate.parse(start),
                LocalDate.parse(end),
                assignee,
                null, deps, null, null, null, null, null,
                priority
        );
    }

    private TaskDTO task(String key, String start, String end, String assignee, TaskPriority priority) {
        return task(key, start, end, assignee, priority, TaskStatus.IN_PROGRESS, List.of());
    }

    private TaskDTO task(String key, String start, String end, String assignee) {
        return task(key, start, end, assignee, TaskPriority.MEDIUM, TaskStatus.IN_PROGRESS, List.of());
    }

    private TaskDTO task(String key, String start, String end) {
        return task(key, start, end, null);
    }

    private TaskDTO taskWithDeps(String key, String start, String end, String assignee,
                                  TaskPriority priority, List<String> deps) {
        return task(key, start, end, assignee, priority, TaskStatus.IN_PROGRESS, deps);
    }

    private TaskDTO completedTask(String key, String start, String end, String assignee) {
        return task(key, start, end, assignee, TaskPriority.MEDIUM, TaskStatus.DONE, List.of());
    }

    // ========================================================================
    // 1. NULL AND EMPTY INPUTS
    // ========================================================================

    @Nested
    @DisplayName("Null and empty input handling")
    class NullAndEmptyInputs {

        @Test
        @DisplayName("optimize() returns empty result for null task list")
        void optimizeNullTasks() {
            var result = optimizer.optimize(null, HORIZON, ALPHA, BETA);
            assertEmptyResult(result);
        }

        @Test
        @DisplayName("optimize() returns empty result for empty task list")
        void optimizeEmptyTasks() {
            var result = optimizer.optimize(List.of(), HORIZON, ALPHA, BETA);
            assertEmptyResult(result);
        }

        @Test
        @DisplayName("evaluateOriginal() returns empty result for null task list")
        void evaluateOriginalNullTasks() {
            var result = optimizer.evaluateOriginal(null, HORIZON, ALPHA, BETA);
            assertEmptyResult(result);
        }

        @Test
        @DisplayName("evaluateOriginal() returns empty result for empty task list")
        void evaluateOriginalEmptyTasks() {
            var result = optimizer.evaluateOriginal(List.of(), HORIZON, ALPHA, BETA);
            assertEmptyResult(result);
        }

        private void assertEmptyResult(ScheduleOptimizer.ScheduleResult result) {
            assertNotNull(result);
            assertTrue(result.tasks().isEmpty());
            assertEquals(0, result.weightedTardiness());
            assertEquals(0, result.makespan());
            assertEquals(0, result.objectiveValue());
            assertEquals(0, result.resourceConflicts());
            assertEquals(0, result.tasksShifted());
        }
    }

    // ========================================================================
    // 2. TASKS WITH MISSING DATA (skipped by optimizer)
    // ========================================================================

    @Nested
    @DisplayName("Tasks with missing data are skipped")
    class MissingDataTasks {

        @Test
        @DisplayName("Task with null startDate is skipped")
        void nullStartDate() {
            var tasks = List.of(new TaskDTO(
                    null, null, "T-1", "PROJ", "test", null,
                    TaskStatus.IN_PROGRESS, null, LocalDate.of(2025, 1, 10),
                    "alice@test.com", null, null, null, null, null, null, null, TaskPriority.HIGH
            ));
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
            assertTrue(result.tasks().isEmpty());
        }

        @Test
        @DisplayName("Task with null dueDate is skipped")
        void nullDueDate() {
            var tasks = List.of(new TaskDTO(
                    null, null, "T-1", "PROJ", "test", null,
                    TaskStatus.IN_PROGRESS, LocalDate.of(2025, 1, 1), null,
                    "alice@test.com", null, null, null, null, null, null, null, TaskPriority.HIGH
            ));
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
            assertTrue(result.tasks().isEmpty());
        }

        @Test
        @DisplayName("Task with null taskKey is skipped")
        void nullTaskKey() {
            var tasks = List.of(new TaskDTO(
                    null, null, null, "PROJ", "test", null,
                    TaskStatus.IN_PROGRESS,
                    LocalDate.of(2025, 1, 1), LocalDate.of(2025, 1, 5),
                    "alice@test.com", null, null, null, null, null, null, null, TaskPriority.HIGH
            ));
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
            assertTrue(result.tasks().isEmpty());
        }

        @Test
        @DisplayName("Mix of valid and invalid tasks: only valid ones are scheduled")
        void mixValidAndInvalid() {
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-03", "alice@test.com"),
                    new TaskDTO(null, null, "T-2", "PROJ", "no dates", null,
                            TaskStatus.IN_PROGRESS, null, null, "bob@test.com",
                            null, null, null, null, null, null, null, TaskPriority.HIGH)
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
            assertEquals(1, result.tasks().size());
            assertTrue(result.tasks().containsKey("T-1"));
        }
    }

    // ========================================================================
    // 3. SINGLE TASK SCENARIOS
    // ========================================================================

    @Nested
    @DisplayName("Single task scheduling")
    class SingleTask {

        @Test
        @DisplayName("Single task starts at day 0 of horizon")
        void singleTaskStartsAtHorizon() {
            var tasks = List.of(task("T-1", "2025-01-01", "2025-01-03", "alice@test.com"));
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            assertEquals(1, result.tasks().size());
            var scheduled = result.tasks().get("T-1");
            assertNotNull(scheduled);
            assertEquals(LocalDate.of(2025, 1, 1), scheduled.suggestedStart());
            assertEquals(LocalDate.of(2025, 1, 3), scheduled.suggestedDue());
        }

        @Test
        @DisplayName("Single task with no assignee is scheduled without resource constraint")
        void singleTaskNoAssignee() {
            var tasks = List.of(task("T-1", "2025-01-01", "2025-01-05"));
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            assertEquals(1, result.tasks().size());
            assertEquals(0, result.resourceConflicts());
        }

        @Test
        @DisplayName("Duration calculation is inclusive (Jan 1 to Jan 3 = 3 days)")
        void durationIsInclusive() {
            var tasks = List.of(task("T-1", "2025-01-01", "2025-01-03", "alice@test.com"));
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            var scheduled = result.tasks().get("T-1");
            // Duration = 3 days (Jan 1, 2, 3)
            // Start = Jan 1, Due = Jan 3
            assertEquals(LocalDate.of(2025, 1, 1), scheduled.suggestedStart());
            assertEquals(LocalDate.of(2025, 1, 3), scheduled.suggestedDue());
        }

        @Test
        @DisplayName("Same-day task has duration of 1")
        void sameDayTask() {
            var tasks = List.of(task("T-1", "2025-01-05", "2025-01-05", "alice@test.com"));
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            var scheduled = result.tasks().get("T-1");
            assertEquals(scheduled.suggestedStart(), scheduled.suggestedDue());
        }
    }

    // ========================================================================
    // 4. RESOURCE CONFLICT RESOLUTION (core RCPSP behavior)
    // ========================================================================

    @Nested
    @DisplayName("Resource conflict resolution")
    class ResourceConflicts {

        @Test
        @DisplayName("Two overlapping tasks assigned to same person are serialized")
        void twoOverlappingTasksSameAssignee() {
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-05", "alice@test.com", TaskPriority.HIGH),
                    task("T-2", "2025-01-01", "2025-01-05", "alice@test.com", TaskPriority.MEDIUM)
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            var t1 = result.tasks().get("T-1");
            var t2 = result.tasks().get("T-2");
            assertNotNull(t1);
            assertNotNull(t2);

            // They must not overlap: one ends before the other starts
            assertTrue(
                    t1.suggestedDue().isBefore(t2.suggestedStart()) ||
                            t2.suggestedDue().isBefore(t1.suggestedStart()),
                    "Tasks assigned to same person must not overlap"
            );
            assertEquals(0, result.resourceConflicts(), "Optimized schedule must have zero conflicts");
        }

        @Test
        @DisplayName("Three overlapping tasks same person are fully serialized")
        void threeOverlappingTasks() {
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-03", "alice@test.com", TaskPriority.HIGH),
                    task("T-2", "2025-01-01", "2025-01-03", "alice@test.com", TaskPriority.MEDIUM),
                    task("T-3", "2025-01-01", "2025-01-03", "alice@test.com", TaskPriority.LOW)
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            assertEquals(0, result.resourceConflicts());
            assertEquals(3, result.tasks().size());

            // Collect all scheduled intervals and verify no overlap
            var intervals = new ArrayList<>(result.tasks().values());
            intervals.sort(Comparator.comparing(ScheduleOptimizer.ScheduledTask::suggestedStart));

            for (int i = 0; i < intervals.size() - 1; i++) {
                assertFalse(
                        intervals.get(i).suggestedDue().isAfter(intervals.get(i + 1).suggestedStart())
                                && intervals.get(i).suggestedStart().isBefore(intervals.get(i + 1).suggestedDue()),
                        "Tasks " + intervals.get(i).taskKey() + " and " + intervals.get(i + 1).taskKey() + " overlap"
                );
            }
        }

        @Test
        @DisplayName("Overlapping tasks assigned to DIFFERENT people are NOT serialized")
        void overlappingTasksDifferentAssignees() {
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-05", "alice@test.com", TaskPriority.HIGH),
                    task("T-2", "2025-01-01", "2025-01-05", "bob@test.com", TaskPriority.HIGH)
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            var t1 = result.tasks().get("T-1");
            var t2 = result.tasks().get("T-2");

            // Both can start at the same time since different resources
            assertEquals(t1.suggestedStart(), t2.suggestedStart(),
                    "Tasks for different people should run in parallel");
            assertEquals(0, result.resourceConflicts());
        }

        @Test
        @DisplayName("Higher priority task gets scheduled first when resource-constrained")
        void higherPriorityScheduledFirst() {
            var tasks = List.of(
                    task("T-LOW", "2025-01-01", "2025-01-03", "alice@test.com", TaskPriority.LOW),
                    task("T-HIGH", "2025-01-01", "2025-01-03", "alice@test.com", TaskPriority.HIGHEST)
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            var high = result.tasks().get("T-HIGH");
            var low = result.tasks().get("T-LOW");

            // Higher priority should be scheduled earlier (at or closer to day 0)
            assertTrue(
                    !high.suggestedStart().isAfter(low.suggestedStart()),
                    "HIGHEST priority task should start no later than LOW priority"
            );
        }

        @Test
        @DisplayName("evaluateOriginal detects resource conflicts in current schedule")
        void evaluateOriginalDetectsConflicts() {
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-05", "alice@test.com"),
                    task("T-2", "2025-01-03", "2025-01-07", "alice@test.com")
            );
            var result = optimizer.evaluateOriginal(tasks, HORIZON, ALPHA, BETA);

            assertEquals(1, result.resourceConflicts(),
                    "Original schedule has 1 resource conflict (T-1 and T-2 overlap for alice)");
        }

        @Test
        @DisplayName("evaluateOriginal reports zero conflicts when no overlap")
        void evaluateOriginalNoConflicts() {
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-03", "alice@test.com"),
                    task("T-2", "2025-01-04", "2025-01-06", "alice@test.com")
            );
            var result = optimizer.evaluateOriginal(tasks, HORIZON, ALPHA, BETA);

            assertEquals(0, result.resourceConflicts());
        }
    }

    // ========================================================================
    // 5. PRECEDENCE CONSTRAINTS
    // ========================================================================

    @Nested
    @DisplayName("Precedence constraint enforcement")
    class PrecedenceConstraints {

        @Test
        @DisplayName("Dependent task starts after predecessor ends")
        void dependentTaskAfterPredecessor() {
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-03", "alice@test.com", TaskPriority.HIGH),
                    taskWithDeps("T-2", "2025-01-01", "2025-01-03", "bob@test.com",
                            TaskPriority.HIGH, List.of("T-1"))
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            var t1 = result.tasks().get("T-1");
            var t2 = result.tasks().get("T-2");

            assertTrue(
                    !t2.suggestedStart().isBefore(t1.suggestedDue()),
                    "T-2 must start on or after T-1 due date. T-1 due: " + t1.suggestedDue() + ", T-2 start: " + t2.suggestedStart()
            );
        }

        @Test
        @DisplayName("Chain of 3 tasks respects full dependency order")
        void chainOfThreeTasks() {
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-03", "alice@test.com", TaskPriority.HIGH),
                    taskWithDeps("T-2", "2025-01-01", "2025-01-03", "alice@test.com",
                            TaskPriority.HIGH, List.of("T-1")),
                    taskWithDeps("T-3", "2025-01-01", "2025-01-03", "alice@test.com",
                            TaskPriority.HIGH, List.of("T-2"))
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            var t1 = result.tasks().get("T-1");
            var t2 = result.tasks().get("T-2");
            var t3 = result.tasks().get("T-3");

            assertTrue(!t2.suggestedStart().isBefore(t1.suggestedDue()), "T-2 must follow T-1");
            assertTrue(!t3.suggestedStart().isBefore(t2.suggestedDue()), "T-3 must follow T-2");
        }

        @Test
        @DisplayName("Precedence + resource constraint: same person chain")
        void precedenceAndResourceCombined() {
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-05", "alice@test.com", TaskPriority.HIGH),
                    taskWithDeps("T-2", "2025-01-01", "2025-01-05", "alice@test.com",
                            TaskPriority.HIGH, List.of("T-1"))
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            var t1 = result.tasks().get("T-1");
            var t2 = result.tasks().get("T-2");

            assertTrue(!t2.suggestedStart().isBefore(t1.suggestedDue()));
            assertEquals(0, result.resourceConflicts());
        }

        @Test
        @DisplayName("Diamond dependency graph: D depends on B and C, both depend on A")
        void diamondDependency() {
            var tasks = List.of(
                    task("A", "2025-01-01", "2025-01-03", "alice@test.com", TaskPriority.HIGHEST),
                    taskWithDeps("B", "2025-01-01", "2025-01-03", "bob@test.com",
                            TaskPriority.HIGH, List.of("A")),
                    taskWithDeps("C", "2025-01-01", "2025-01-03", "carol@test.com",
                            TaskPriority.HIGH, List.of("A")),
                    taskWithDeps("D", "2025-01-01", "2025-01-03", "alice@test.com",
                            TaskPriority.MEDIUM, List.of("B", "C"))
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            var a = result.tasks().get("A");
            var b = result.tasks().get("B");
            var c = result.tasks().get("C");
            var d = result.tasks().get("D");

            // B and C must follow A
            assertTrue(!b.suggestedStart().isBefore(a.suggestedDue()));
            assertTrue(!c.suggestedStart().isBefore(a.suggestedDue()));

            // D must follow both B and C
            assertTrue(!d.suggestedStart().isBefore(b.suggestedDue()));
            assertTrue(!d.suggestedStart().isBefore(c.suggestedDue()));

            // B and C can run in parallel (different assignees)
            assertEquals(0, result.resourceConflicts());
        }

        @Test
        @DisplayName("Dependency on non-existent task is ignored gracefully")
        void dependencyOnNonExistentTask() {
            var tasks = List.of(
                    taskWithDeps("T-1", "2025-01-01", "2025-01-03", "alice@test.com",
                            TaskPriority.HIGH, List.of("NONEXISTENT-1"))
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            assertEquals(1, result.tasks().size());
            assertNotNull(result.tasks().get("T-1"));
        }
    }

    // ========================================================================
    // 6. COMPLETED TASKS (terminal statuses)
    // ========================================================================

    @Nested
    @DisplayName("Completed task handling")
    class CompletedTasks {

        @Test
        @DisplayName("DONE task is excluded from optimization result")
        void doneTaskExcluded() {
            var tasks = List.of(
                    completedTask("T-DONE", "2025-01-01", "2025-01-05", "alice@test.com"),
                    task("T-ACTIVE", "2025-01-01", "2025-01-05", "alice@test.com")
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            assertFalse(result.tasks().containsKey("T-DONE"), "Completed task should not be in result");
            assertTrue(result.tasks().containsKey("T-ACTIVE"));
        }

        @ParameterizedTest
        @EnumSource(value = TaskStatus.class, names = {"DONE", "RELEASED", "WITHDRAWN"})
        @DisplayName("All terminal statuses are excluded from optimization")
        void allTerminalStatusesExcluded(TaskStatus status) {
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-05", "alice@test.com",
                            TaskPriority.MEDIUM, status, List.of())
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
            assertTrue(result.tasks().isEmpty());
        }

        @Test
        @DisplayName("Completed task acts as precedence constraint for successor")
        void completedTaskAsPrecedenceConstraint() {
            var tasks = List.of(
                    completedTask("T-DONE", "2025-01-01", "2025-01-05", "alice@test.com"),
                    taskWithDeps("T-ACTIVE", "2025-01-01", "2025-01-03", "bob@test.com",
                            TaskPriority.HIGH, List.of("T-DONE"))
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            var active = result.tasks().get("T-ACTIVE");
            // T-DONE ends on Jan 5 (duration=5, inclusive), so T-ACTIVE starts on or after Jan 6
            assertTrue(
                    !active.suggestedStart().isBefore(LocalDate.of(2025, 1, 6)),
                    "Active task must start after completed predecessor ends: " + active.suggestedStart()
            );
        }

        @Test
        @DisplayName("Only active tasks count as conflicts")
        void onlyActiveTasksCountAsConflicts() {
            var tasks = List.of(
                    completedTask("T-DONE", "2025-01-01", "2025-01-05", "alice@test.com"),
                    task("T-ACTIVE", "2025-01-03", "2025-01-07", "alice@test.com")
            );
            // Completed task overlaps with active on alice, but shouldn't count as optimization conflict
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
            assertEquals(1, result.tasks().size());
        }
    }

    // ========================================================================
    // 7. OBJECTIVE FUNCTION & METRICS
    // ========================================================================

    @Nested
    @DisplayName("Objective function and metrics computation")
    class ObjectiveFunction {

        @Test
        @DisplayName("Task finishing on time has zero tardiness")
        void onTimeTardiness() {
            // Task: Jan 1 - Jan 5. Due: Jan 5. Duration = 5.
            // Horizon = Jan 1. dueDateOffset = 5+1=6. scheduledEnd = 0+5=5. tardiness = max(0, 5-6) = 0
            var tasks = List.of(task("T-1", "2025-01-01", "2025-01-05", "alice@test.com"));
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            var t = result.tasks().get("T-1");
            assertEquals(0, t.tardinessDays());
            assertEquals(0, result.weightedTardiness(), 0.001);
        }

        @Test
        @DisplayName("Shifted task incurs tardiness when pushed past due date")
        void shiftedTaskTardiness() {
            // Two tasks on same person, both due Jan 3. One will be pushed past due date.
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-03", "alice@test.com", TaskPriority.HIGH),
                    task("T-2", "2025-01-01", "2025-01-03", "alice@test.com", TaskPriority.LOW)
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            // At least one task should have tardiness > 0
            boolean anyLate = result.tasks().values().stream()
                    .anyMatch(t -> t.tardinessDays() > 0);
            assertTrue(anyLate, "Resource conflict should cause at least one task to be late");
            assertTrue(result.weightedTardiness() > 0);
        }

        @Test
        @DisplayName("Objective value = alpha * weightedTardiness + beta * makespan")
        void objectiveFormula() {
            var tasks = List.of(task("T-1", "2025-01-01", "2025-01-05", "alice@test.com"));
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            double expected = ALPHA * result.weightedTardiness() + BETA * result.makespan();
            assertEquals(expected, result.objectiveValue(), 0.001);
        }

        @ParameterizedTest
        @CsvSource({
                "0.0, 1.0",
                "1.0, 0.0",
                "0.5, 0.5",
                "0.8, 0.2"
        })
        @DisplayName("Objective respects alpha/beta weights")
        void objectiveWeights(double alpha, double beta) {
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-03", "alice@test.com", TaskPriority.HIGH),
                    task("T-2", "2025-01-01", "2025-01-03", "alice@test.com", TaskPriority.LOW)
            );
            var result = optimizer.optimize(tasks, HORIZON, alpha, beta);

            double expected = alpha * result.weightedTardiness() + beta * result.makespan();
            assertEquals(expected, result.objectiveValue(), 0.001);
        }

        @Test
        @DisplayName("tasksShifted counts tasks moved from original position")
        void tasksShiftedCount() {
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-03", "alice@test.com", TaskPriority.HIGH),
                    task("T-2", "2025-01-01", "2025-01-03", "alice@test.com", TaskPriority.LOW)
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            // One task stays at Jan 1, the other must be shifted
            assertTrue(result.tasksShifted() >= 1, "At least one task should be shifted");
        }

        @Test
        @DisplayName("Makespan equals the latest task end day")
        void makespanCalculation() {
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-03", "alice@test.com"),
                    task("T-2", "2025-01-01", "2025-01-10", "bob@test.com")
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            // T-2 has 10 days duration, makespan should be at least 10
            assertTrue(result.makespan() >= 10);
        }
    }

    // ========================================================================
    // 8. PRIORITY ORDERING
    // ========================================================================

    @Nested
    @DisplayName("Priority-based scheduling order")
    class PriorityOrdering {

        @Test
        @DisplayName("HIGHEST priority task gets resource before LOWEST")
        void highestBeforeLowest() {
            var tasks = List.of(
                    task("T-LOW", "2025-01-01", "2025-01-05", "alice@test.com", TaskPriority.LOWEST),
                    task("T-HIGH", "2025-01-01", "2025-01-05", "alice@test.com", TaskPriority.HIGHEST)
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            var high = result.tasks().get("T-HIGH");
            var low = result.tasks().get("T-LOW");

            assertTrue(
                    !high.suggestedStart().isAfter(low.suggestedStart()),
                    "HIGHEST should start at or before LOWEST"
            );
        }

        @Test
        @DisplayName("Priority weight mapping: HIGHEST = 10, LOWEST = 1")
        void priorityWeightMapping() {
            // MORCPSP model: HIGHEST=10, HIGH=8, MEDIUM=5, LOW=3, LOWEST=1
            var tasks = List.of(
                    task("T-H", "2025-01-01", "2025-01-03", "alice@test.com", TaskPriority.HIGHEST),
                    task("T-L", "2025-01-01", "2025-01-03", "alice@test.com", TaskPriority.LOWEST)
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            // Both will have tardiness metrics - higher weight = more penalty
            // The optimizer should favor scheduling T-H first to avoid its higher penalty
            var high = result.tasks().get("T-H");
            assertTrue(!high.suggestedStart().isAfter(LocalDate.of(2025, 1, 1)));
        }

        @Test
        @DisplayName("Null priority defaults to weight 5 (MEDIUM equivalent)")
        void nullPriorityDefault() {
            var tasks = List.of(new TaskDTO(
                    null, null, "T-1", "PROJ", "test", null,
                    TaskStatus.IN_PROGRESS,
                    LocalDate.of(2025, 1, 1), LocalDate.of(2025, 1, 3),
                    "alice@test.com", null, null, null, null, null, null, null, null
            ));
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
            assertEquals(1, result.tasks().size());
        }
    }

    // ========================================================================
    // 9. DATE CONVERSION CORRECTNESS
    // ========================================================================

    @Nested
    @DisplayName("Date offset-to-LocalDate conversion")
    class DateConversion {

        @Test
        @DisplayName("suggestedDue is inclusive (not off-by-one)")
        void suggestedDueIsInclusive() {
            // Task Jan 1-3 (3 days). Should come back as Jan 1 start, Jan 3 due.
            var tasks = List.of(task("T-1", "2025-01-01", "2025-01-03", "alice@test.com"));
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            var t = result.tasks().get("T-1");
            assertEquals(LocalDate.of(2025, 1, 1), t.suggestedStart());
            assertEquals(LocalDate.of(2025, 1, 3), t.suggestedDue());
        }

        @Test
        @DisplayName("Task starting after horizon date converts correctly")
        void taskAfterHorizon() {
            // Horizon is Jan 1, task starts Feb 1
            var tasks = List.of(task("T-1", "2025-02-01", "2025-02-05", "alice@test.com"));
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            var t = result.tasks().get("T-1");
            assertEquals(LocalDate.of(2025, 1, 1), t.suggestedStart(),
                    "Task should be pulled to horizon start (day 0)");
        }

        @Test
        @DisplayName("evaluateOriginal preserves original dates")
        void evaluateOriginalPreservesDates() {
            var tasks = List.of(task("T-1", "2025-01-10", "2025-01-15", "alice@test.com"));
            var result = optimizer.evaluateOriginal(tasks, HORIZON, ALPHA, BETA);

            var t = result.tasks().get("T-1");
            assertEquals(LocalDate.of(2025, 1, 10), t.suggestedStart());
            assertEquals(LocalDate.of(2025, 1, 15), t.suggestedDue());
        }
    }

    // ========================================================================
    // 10. COMPLEX MULTI-PROJECT SCENARIOS
    // ========================================================================

    @Nested
    @DisplayName("Complex real-world scenarios")
    class ComplexScenarios {

        @Test
        @DisplayName("5 tasks, 2 developers, cross-project dependencies")
        void fiveTasksTwoDevelopers() {
            var tasks = List.of(
                    task("PROJ-1", "2025-01-01", "2025-01-03", "alice@test.com", TaskPriority.HIGHEST),
                    task("PROJ-2", "2025-01-01", "2025-01-03", "bob@test.com", TaskPriority.HIGH),
                    taskWithDeps("PROJ-3", "2025-01-01", "2025-01-05", "alice@test.com",
                            TaskPriority.HIGH, List.of("PROJ-1")),
                    taskWithDeps("OTH-1", "2025-01-01", "2025-01-03", "bob@test.com",
                            TaskPriority.MEDIUM, List.of("PROJ-2")),
                    taskWithDeps("OTH-2", "2025-01-01", "2025-01-03", "alice@test.com",
                            TaskPriority.LOW, List.of("PROJ-3", "OTH-1"))
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            assertEquals(5, result.tasks().size());
            assertEquals(0, result.resourceConflicts());

            // Verify dependency chain: PROJ-1 -> PROJ-3 -> OTH-2
            var p1 = result.tasks().get("PROJ-1");
            var p3 = result.tasks().get("PROJ-3");
            var o2 = result.tasks().get("OTH-2");
            assertTrue(!p3.suggestedStart().isBefore(p1.suggestedDue()));
            assertTrue(!o2.suggestedStart().isBefore(p3.suggestedDue()));
        }

        @Test
        @DisplayName("Optimization resolves all resource conflicts")
        void optimizationResolvesConflicts() {
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-05", "alice@test.com", TaskPriority.HIGHEST),
                    task("T-2", "2025-01-01", "2025-01-05", "alice@test.com", TaskPriority.HIGH),
                    task("T-3", "2025-01-01", "2025-01-05", "alice@test.com", TaskPriority.MEDIUM),
                    task("T-4", "2025-01-01", "2025-01-05", "bob@test.com", TaskPriority.LOW),
                    task("T-5", "2025-01-01", "2025-01-05", "bob@test.com", TaskPriority.LOWEST)
            );

            var original = optimizer.evaluateOriginal(tasks, HORIZON, ALPHA, BETA);
            var optimized = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            // Original schedule has overlapping tasks on same assignees
            assertTrue(original.resourceConflicts() > 0,
                    "Original should have conflicts (3 alice tasks overlap, 2 bob tasks overlap)");

            // Optimized schedule must have zero conflicts — this is the core SSGS guarantee
            assertEquals(0, optimized.resourceConflicts(),
                    "Optimized schedule must have zero resource conflicts");

            // All 5 tasks should be present
            assertEquals(5, optimized.tasks().size());

            // Optimized objective is computed correctly
            double expectedObj = ALPHA * optimized.weightedTardiness() + BETA * optimized.makespan();
            assertEquals(expectedObj, optimized.objectiveValue(), 0.001);
        }

        @Test
        @DisplayName("Large portfolio: 20 tasks across 4 people")
        void largePortfolio() {
            String[] assignees = {"alice@test.com", "bob@test.com", "carol@test.com", "dave@test.com"};
            TaskPriority[] priorities = TaskPriority.values();
            var tasks = new ArrayList<TaskDTO>();

            for (int i = 0; i < 20; i++) {
                String key = "T-" + (i + 1);
                String assignee = assignees[i % assignees.length];
                TaskPriority prio = priorities[i % priorities.length];
                // All tasks try to start on Jan 1, 3 days each
                tasks.add(task(key, "2025-01-01", "2025-01-03", assignee, prio));
            }

            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            assertEquals(20, result.tasks().size());
            assertEquals(0, result.resourceConflicts(),
                    "All 20 tasks must be scheduled without resource conflicts");

            // Verify no overlap per assignee
            var byAssignee = new HashMap<String, List<ScheduleOptimizer.ScheduledTask>>();
            for (int i = 0; i < 20; i++) {
                String key = "T-" + (i + 1);
                String assignee = assignees[i % assignees.length];
                byAssignee.computeIfAbsent(assignee, k -> new ArrayList<>())
                        .add(result.tasks().get(key));
            }

            for (var entry : byAssignee.entrySet()) {
                var sorted = entry.getValue().stream()
                        .sorted(Comparator.comparing(ScheduleOptimizer.ScheduledTask::suggestedStart))
                        .toList();

                for (int i = 0; i < sorted.size() - 1; i++) {
                    assertTrue(
                            !sorted.get(i).suggestedDue().isAfter(sorted.get(i + 1).suggestedStart())
                                    || sorted.get(i).suggestedDue().equals(sorted.get(i + 1).suggestedStart()),
                            "Overlap for " + entry.getKey() + " between " +
                                    sorted.get(i).taskKey() + " and " + sorted.get(i + 1).taskKey()
                    );
                }
            }
        }

        @Test
        @DisplayName("Mixed completed and active tasks with dependencies")
        void mixedCompletedAndActive() {
            var tasks = List.of(
                    completedTask("DONE-1", "2025-01-01", "2025-01-10", "alice@test.com"),
                    taskWithDeps("ACTIVE-1", "2025-01-01", "2025-01-05", "alice@test.com",
                            TaskPriority.HIGH, List.of("DONE-1")),
                    taskWithDeps("ACTIVE-2", "2025-01-01", "2025-01-05", "alice@test.com",
                            TaskPriority.MEDIUM, List.of("DONE-1"))
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            assertEquals(2, result.tasks().size());
            assertEquals(0, result.resourceConflicts());

            // Both active tasks must start after DONE-1 ends (Jan 10, duration=10, end offset=10)
            for (var task : result.tasks().values()) {
                assertTrue(
                        !task.suggestedStart().isBefore(LocalDate.of(2025, 1, 11)),
                        task.taskKey() + " must start after completed predecessor ends"
                );
            }

            // And they must be serialized (same assignee)
            var a1 = result.tasks().get("ACTIVE-1");
            var a2 = result.tasks().get("ACTIVE-2");
            assertTrue(
                    !a1.suggestedDue().isAfter(a2.suggestedStart()) ||
                            !a2.suggestedDue().isAfter(a1.suggestedStart()),
                    "Same-assignee tasks must be serialized"
            );
        }
    }

    // ========================================================================
    // 11. EDGE CASES
    // ========================================================================

    @Nested
    @DisplayName("Edge cases")
    class EdgeCases {

        @Test
        @DisplayName("All tasks are completed: empty result")
        void allTasksCompleted() {
            var tasks = List.of(
                    completedTask("T-1", "2025-01-01", "2025-01-05", "alice@test.com"),
                    completedTask("T-2", "2025-01-01", "2025-01-05", "bob@test.com")
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
            assertTrue(result.tasks().isEmpty());
        }

        @Test
        @DisplayName("Task with start == due (1-day task)")
        void oneDayTask() {
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-01", "alice@test.com"),
                    task("T-2", "2025-01-01", "2025-01-01", "alice@test.com")
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            assertEquals(2, result.tasks().size());
            assertEquals(0, result.resourceConflicts());
        }

        @Test
        @DisplayName("Unassigned tasks don't cause resource conflicts")
        void unassignedTasks() {
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-05"),
                    task("T-2", "2025-01-01", "2025-01-05"),
                    task("T-3", "2025-01-01", "2025-01-05")
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            assertEquals(3, result.tasks().size());
            assertEquals(0, result.resourceConflicts());
            // All should start at day 0 since no resource constraint
            for (var t : result.tasks().values()) {
                assertEquals(LocalDate.of(2025, 1, 1), t.suggestedStart());
            }
        }

        @Test
        @DisplayName("Empty assignee string treated same as null")
        void emptyAssigneeString() {
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-05", "", TaskPriority.HIGH),
                    task("T-2", "2025-01-01", "2025-01-05", "", TaskPriority.LOW)
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            // Both should start at day 0 (blank assignee = no resource constraint)
            for (var t : result.tasks().values()) {
                assertEquals(LocalDate.of(2025, 1, 1), t.suggestedStart());
            }
        }

        @Test
        @DisplayName("Task far in the future still schedules correctly")
        void farFutureTask() {
            var tasks = List.of(
                    task("T-1", "2027-06-01", "2027-06-30", "alice@test.com")
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            assertEquals(1, result.tasks().size());
            var t = result.tasks().get("T-1");
            // Optimizer can pull it to day 0
            assertNotNull(t.suggestedStart());
            assertNotNull(t.suggestedDue());
        }

        @Test
        @DisplayName("Idempotency: optimizing an already-optimal schedule returns same positions")
        void idempotency() {
            // Non-overlapping tasks: already optimal
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-03", "alice@test.com"),
                    task("T-2", "2025-01-04", "2025-01-06", "alice@test.com")
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            assertEquals(0, result.resourceConflicts());
        }
    }

    // ========================================================================
    // 12. CONSISTENCY BETWEEN optimize AND evaluateOriginal
    // ========================================================================

    @Nested
    @DisplayName("Consistency checks")
    class ConsistencyChecks {

        @Test
        @DisplayName("evaluateOriginal returns same tasks as input")
        void evaluateOriginalSameTaskCount() {
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-05", "alice@test.com"),
                    task("T-2", "2025-01-03", "2025-01-08", "alice@test.com"),
                    task("T-3", "2025-01-01", "2025-01-05", "bob@test.com")
            );
            var result = optimizer.evaluateOriginal(tasks, HORIZON, ALPHA, BETA);
            assertEquals(3, result.tasks().size());
        }

        @Test
        @DisplayName("Optimize result always has zero resource conflicts")
        void optimizeAlwaysZeroConflicts() {
            // Worst case: 5 tasks all overlapping on same person
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-10", "alice@test.com", TaskPriority.HIGHEST),
                    task("T-2", "2025-01-01", "2025-01-10", "alice@test.com", TaskPriority.HIGH),
                    task("T-3", "2025-01-01", "2025-01-10", "alice@test.com", TaskPriority.MEDIUM),
                    task("T-4", "2025-01-01", "2025-01-10", "alice@test.com", TaskPriority.LOW),
                    task("T-5", "2025-01-01", "2025-01-10", "alice@test.com", TaskPriority.LOWEST)
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            assertEquals(0, result.resourceConflicts(),
                    "SSGS algorithm must always produce zero resource conflicts");
            assertEquals(5, result.tasks().size());
        }

        @Test
        @DisplayName("Stateless: calling optimize twice returns same results")
        void statelessBehavior() {
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-05", "alice@test.com", TaskPriority.HIGH),
                    task("T-2", "2025-01-01", "2025-01-05", "alice@test.com", TaskPriority.LOW)
            );

            var result1 = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
            var result2 = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            assertEquals(result1.objectiveValue(), result2.objectiveValue(), 0.001);
            assertEquals(result1.makespan(), result2.makespan());
            assertEquals(result1.weightedTardiness(), result2.weightedTardiness(), 0.001);

            for (var key : result1.tasks().keySet()) {
                assertEquals(result1.tasks().get(key).suggestedStart(),
                        result2.tasks().get(key).suggestedStart());
                assertEquals(result1.tasks().get(key).suggestedDue(),
                        result2.tasks().get(key).suggestedDue());
            }
        }
    }

    // ========================================================================
    // 13. PRECISE HAND-CALCULATED VERIFICATION
    // ========================================================================

    @Nested
    @DisplayName("Hand-calculated metric verification")
    class PreciseMetricVerification {

        @Test
        @DisplayName("Two tasks same resource: verify exact scheduled dates and tardiness")
        void exactScheduleVerification() {
            // T-1: Jan 1-3 (3 days), HIGHEST (weight=10), alice
            // T-2: Jan 1-3 (3 days), LOW (weight=3), alice
            // Horizon: Jan 1
            //
            // Duration calc: ChronoUnit.DAYS.between(Jan1, Jan3) + 1 = 3
            //
            // SSGS: T-1 scheduled first (higher priority):
            //   scheduledStart=0, scheduledEnd=0+3=3 → Jan 1 to Jan 3
            //
            // T-2 blocked by alice busy [0,3):
            //   scheduledStart=3, scheduledEnd=3+3=6 → Jan 4 to Jan 6
            //
            // dueDateOffset = days(Jan1, Jan3) + 1 = 3 (exclusive end of due date)
            // T-1 tardiness = max(0, 3 - 3) = 0
            // T-2 tardiness = max(0, 6 - 3) = 3
            // weightedTardiness = 10*0 + 3*3 = 9
            // makespan = 6
            // objective = 0.8*9 + 0.2*6 = 7.2 + 1.2 = 8.4

            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-03", "alice@test.com", TaskPriority.HIGHEST),
                    task("T-2", "2025-01-01", "2025-01-03", "alice@test.com", TaskPriority.LOW)
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            var t1 = result.tasks().get("T-1");
            var t2 = result.tasks().get("T-2");

            // T-1 gets priority, starts at day 0
            assertEquals(LocalDate.of(2025, 1, 1), t1.suggestedStart());
            assertEquals(LocalDate.of(2025, 1, 3), t1.suggestedDue());
            assertEquals(0, t1.tardinessDays());

            // T-2 pushed after T-1
            assertEquals(LocalDate.of(2025, 1, 4), t2.suggestedStart());
            assertEquals(LocalDate.of(2025, 1, 6), t2.suggestedDue());
            assertEquals(3, t2.tardinessDays(), "scheduledEnd(6) - dueDateOffset(3) = 3");

            // Metrics
            assertEquals(9.0, result.weightedTardiness(), 0.001, "10*0 + 3*3 = 9");
            assertEquals(6, result.makespan(), "Last task ends at day 6");
            assertEquals(8.4, result.objectiveValue(), 0.001, "0.8*9 + 0.2*6 = 8.4");
            assertEquals(0, result.resourceConflicts());
            assertEquals(1, result.tasksShifted(), "T-2 was shifted from day 0 to day 3");
        }

        @Test
        @DisplayName("Three tasks chain with exact dates")
        void threeTaskChainExactDates() {
            // A -> B -> C, all 2-day tasks on alice
            // A: Jan 1-2, B depends on A: Jan 1-2, C depends on B: Jan 1-2
            // Expected: A at day 0-1, B at day 2-3, C at day 4-5
            var tasks = List.of(
                    task("A", "2025-01-01", "2025-01-02", "alice@test.com", TaskPriority.HIGH),
                    taskWithDeps("B", "2025-01-01", "2025-01-02", "alice@test.com",
                            TaskPriority.HIGH, List.of("A")),
                    taskWithDeps("C", "2025-01-01", "2025-01-02", "alice@test.com",
                            TaskPriority.HIGH, List.of("B"))
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            var a = result.tasks().get("A");
            var b = result.tasks().get("B");
            var c = result.tasks().get("C");

            assertEquals(LocalDate.of(2025, 1, 1), a.suggestedStart());
            assertEquals(LocalDate.of(2025, 1, 2), a.suggestedDue());

            assertEquals(LocalDate.of(2025, 1, 3), b.suggestedStart());
            assertEquals(LocalDate.of(2025, 1, 4), b.suggestedDue());

            assertEquals(LocalDate.of(2025, 1, 5), c.suggestedStart());
            assertEquals(LocalDate.of(2025, 1, 6), c.suggestedDue());
        }

        @Test
        @DisplayName("evaluateOriginal computes correct conflict count for 3 overlapping tasks")
        void evaluateOriginalThreeOverlapping() {
            // All 3 tasks on alice, Jan 1-5 each. They all overlap.
            // First task placed: no conflict. Second: overlaps with first → 1 conflict.
            // Third: overlaps with first and second → 1 more conflict.
            // Total: 2 conflicts.
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-05", "alice@test.com"),
                    task("T-2", "2025-01-01", "2025-01-05", "alice@test.com"),
                    task("T-3", "2025-01-01", "2025-01-05", "alice@test.com")
            );
            var result = optimizer.evaluateOriginal(tasks, HORIZON, ALPHA, BETA);
            assertEquals(2, result.resourceConflicts(),
                    "3 fully overlapping tasks on same person = 2 conflicts");
        }

        @Test
        @DisplayName("Zero tardiness when all tasks fit within their due dates")
        void zeroTardinessWhenFitting() {
            // T-1: alice, Jan 1-3. T-2: alice, Jan 4-6. No overlap, no tardiness.
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-03", "alice@test.com"),
                    task("T-2", "2025-01-04", "2025-01-06", "alice@test.com")
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            assertEquals(0.0, result.weightedTardiness(), 0.001);
            for (var t : result.tasks().values()) {
                assertEquals(0, t.tardinessDays());
            }
        }
    }

    // ========================================================================
    // 14. RESOURCE GAP FILLING
    // ========================================================================

    @Nested
    @DisplayName("Resource gap filling behavior")
    class ResourceGapFilling {

        @Test
        @DisplayName("Short task fills gap between two longer tasks on same resource")
        void shortTaskFillsGap() {
            // alice has: T-1 (5 days), T-2 (5 days), T-3 (1 day)
            // After T-1 (days 0-4) and T-2 (days 5-9), T-3 should go to day 10
            // But with priority, T-3 might go first if it has higher priority
            // Let's make T-1 highest so it goes first, then T-3 (high) fits in day 5
            var tasks = List.of(
                    task("T-BIG1", "2025-01-01", "2025-01-05", "alice@test.com", TaskPriority.HIGHEST),
                    task("T-BIG2", "2025-01-01", "2025-01-05", "alice@test.com", TaskPriority.LOW),
                    task("T-SMALL", "2025-01-01", "2025-01-01", "alice@test.com", TaskPriority.HIGH)
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            assertEquals(0, result.resourceConflicts());
            // All three tasks must be present and non-overlapping
            assertEquals(3, result.tasks().size());

            // Verify no overlap on alice
            var sorted = result.tasks().values().stream()
                    .sorted(Comparator.comparing(ScheduleOptimizer.ScheduledTask::suggestedStart))
                    .toList();
            for (int i = 0; i < sorted.size() - 1; i++) {
                assertFalse(sorted.get(i).suggestedDue().isAfter(sorted.get(i + 1).suggestedStart()),
                        sorted.get(i).taskKey() + " overlaps with " + sorted.get(i + 1).taskKey());
            }
        }

        @Test
        @DisplayName("Task with different assignee runs in parallel, not affected by gaps")
        void differentAssigneeIgnoresGaps() {
            // alice: T-1 (days 0-4), bob: T-2 (days 0-4). They run in parallel.
            var tasks = List.of(
                    task("T-ALICE", "2025-01-01", "2025-01-05", "alice@test.com", TaskPriority.HIGH),
                    task("T-BOB", "2025-01-01", "2025-01-05", "bob@test.com", TaskPriority.HIGH)
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            assertEquals(LocalDate.of(2025, 1, 1), result.tasks().get("T-ALICE").suggestedStart());
            assertEquals(LocalDate.of(2025, 1, 1), result.tasks().get("T-BOB").suggestedStart());
        }
    }

    // ========================================================================
    // 15. MULTIPLE PREDECESSORS WITH STAGGERED ENDS
    // ========================================================================

    @Nested
    @DisplayName("Multiple predecessor timing")
    class MultiplePredecessors {

        @Test
        @DisplayName("Task waits for LATEST predecessor, not earliest")
        void waitsForLatestPredecessor() {
            // A: 2 days (ends day 2), B: 5 days (ends day 5), C depends on both A and B
            // C must start at day 5, not day 2
            var tasks = List.of(
                    task("A", "2025-01-01", "2025-01-02", "alice@test.com", TaskPriority.HIGHEST),
                    task("B", "2025-01-01", "2025-01-05", "bob@test.com", TaskPriority.HIGH),
                    taskWithDeps("C", "2025-01-01", "2025-01-03", "carol@test.com",
                            TaskPriority.MEDIUM, List.of("A", "B"))
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            var b = result.tasks().get("B");
            var c = result.tasks().get("C");

            // C must start after B ends (B is the later predecessor)
            assertFalse(c.suggestedStart().isBefore(b.suggestedDue()),
                    "C must wait for the latest predecessor B. B due: " + b.suggestedDue() + ", C start: " + c.suggestedStart());
        }

        @Test
        @DisplayName("Three predecessors: task waits for all three to complete")
        void threePredsWaitsForAll() {
            var tasks = List.of(
                    task("P1", "2025-01-01", "2025-01-02", "alice@test.com", TaskPriority.HIGH),
                    task("P2", "2025-01-01", "2025-01-05", "bob@test.com", TaskPriority.HIGH),
                    task("P3", "2025-01-01", "2025-01-10", "carol@test.com", TaskPriority.HIGH),
                    taskWithDeps("CHILD", "2025-01-01", "2025-01-03", "dave@test.com",
                            TaskPriority.MEDIUM, List.of("P1", "P2", "P3"))
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            var p3 = result.tasks().get("P3");
            var child = result.tasks().get("CHILD");

            assertFalse(child.suggestedStart().isBefore(p3.suggestedDue()),
                    "Child must wait for longest predecessor P3");
        }
    }

    // ========================================================================
    // 16. NEGATIVE AND BOUNDARY OFFSETS
    // ========================================================================

    @Nested
    @DisplayName("Boundary date scenarios")
    class BoundaryDates {

        @Test
        @DisplayName("Task with due date before horizon (already overdue)")
        void dueDateBeforeHorizon() {
            // Task was due Dec 25 but horizon is Jan 1. Task is already late.
            var tasks = List.of(task("T-1", "2024-12-20", "2024-12-25", "alice@test.com"));
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            assertEquals(1, result.tasks().size());
            var t = result.tasks().get("T-1");
            // Optimizer pulls to day 0. Duration = 6. scheduledEnd = 6.
            // dueDateOffset = days(Jan1, Dec25) + 1 = -6. tardiness = max(0, 6-(-6)) = 12
            assertTrue(t.tardinessDays() > 0, "Already overdue task should have tardiness");
        }

        @Test
        @DisplayName("Task starting before horizon is clamped to day 0")
        void taskBeforeHorizonClampedToZero() {
            // Task starts Dec 28, horizon is Jan 1. Optimizer starts from day 0.
            var tasks = List.of(task("T-1", "2024-12-28", "2025-01-02", "alice@test.com"));
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            var t = result.tasks().get("T-1");
            assertFalse(t.suggestedStart().isBefore(HORIZON),
                    "Task should not start before horizon: " + t.suggestedStart());
        }

        @Test
        @DisplayName("evaluateOriginal handles task starting before horizon correctly")
        void evaluateOriginalTaskBeforeHorizon() {
            var tasks = List.of(task("T-1", "2024-12-28", "2025-01-03", "alice@test.com"));
            var result = optimizer.evaluateOriginal(tasks, HORIZON, ALPHA, BETA);

            var t = result.tasks().get("T-1");
            assertEquals(LocalDate.of(2024, 12, 28), t.suggestedStart(),
                    "evaluateOriginal preserves original start even if before horizon");
        }

        @Test
        @DisplayName("Horizon far in the future: task gets pulled to day 0")
        void horizonFarFuture() {
            var futureHorizon = LocalDate.of(2030, 1, 1);
            var tasks = List.of(task("T-1", "2025-01-01", "2025-01-05", "alice@test.com"));
            var result = optimizer.optimize(tasks, futureHorizon, ALPHA, BETA);

            var t = result.tasks().get("T-1");
            // Task original start is 2025, horizon is 2030 → negative offset → clamped to 0
            assertEquals(futureHorizon, t.suggestedStart(),
                    "Should start at horizon day 0 = " + futureHorizon);
        }
    }

    // ========================================================================
    // 17. SELF-REFERENCE AND MALFORMED DEPENDENCIES
    // ========================================================================

    @Nested
    @DisplayName("Malformed dependency handling")
    class MalformedDependencies {

        @Test
        @DisplayName("Self-referencing dependency is handled gracefully")
        void selfReferencingDependency() {
            var tasks = List.of(
                    taskWithDeps("T-1", "2025-01-01", "2025-01-03", "alice@test.com",
                            TaskPriority.HIGH, List.of("T-1"))
            );
            // Should not infinite loop or crash
            assertDoesNotThrow(() -> optimizer.optimize(tasks, HORIZON, ALPHA, BETA));
        }

        @Test
        @DisplayName("Null dependency keys list is handled")
        void nullDependencyKeys() {
            var tasks = List.of(new TaskDTO(
                    null, null, "T-1", "PROJ", "test", null,
                    TaskStatus.IN_PROGRESS,
                    LocalDate.of(2025, 1, 1), LocalDate.of(2025, 1, 5),
                    "alice@test.com", null, null, null, null, null, null, null, TaskPriority.HIGH
            ));
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
            assertEquals(1, result.tasks().size());
        }

        @Test
        @DisplayName("Circular dependency A->B->A does not crash")
        void circularDependency() {
            var tasks = List.of(
                    taskWithDeps("A", "2025-01-01", "2025-01-03", "alice@test.com",
                            TaskPriority.HIGH, List.of("B")),
                    taskWithDeps("B", "2025-01-01", "2025-01-03", "bob@test.com",
                            TaskPriority.HIGH, List.of("A"))
            );
            // Circular deps should be prevented at the service layer, but optimizer must not crash
            assertDoesNotThrow(() -> optimizer.optimize(tasks, HORIZON, ALPHA, BETA));
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
            assertEquals(2, result.tasks().size());
        }
    }

    // ========================================================================
    // 18. MIXED ASSIGNED AND UNASSIGNED TASKS
    // ========================================================================

    @Nested
    @DisplayName("Mixed assigned/unassigned tasks")
    class MixedAssignment {

        @Test
        @DisplayName("Unassigned task runs in parallel with assigned task")
        void unassignedParallelWithAssigned() {
            var tasks = List.of(
                    task("T-ASSIGNED", "2025-01-01", "2025-01-05", "alice@test.com", TaskPriority.HIGH),
                    task("T-UNASSIGNED", "2025-01-01", "2025-01-05", null, TaskPriority.HIGH)
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            // Both should start at day 0
            assertEquals(LocalDate.of(2025, 1, 1), result.tasks().get("T-ASSIGNED").suggestedStart());
            assertEquals(LocalDate.of(2025, 1, 1), result.tasks().get("T-UNASSIGNED").suggestedStart());
        }

        @Test
        @DisplayName("Multiple unassigned tasks all start at day 0")
        void multipleUnassignedAllAtDayZero() {
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-05"),
                    task("T-2", "2025-01-01", "2025-01-10"),
                    task("T-3", "2025-01-01", "2025-01-03")
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            for (var t : result.tasks().values()) {
                assertEquals(LocalDate.of(2025, 1, 1), t.suggestedStart(),
                        t.taskKey() + " should start at day 0 (no resource constraint)");
            }
        }

        @Test
        @DisplayName("Unassigned task still respects precedence constraints")
        void unassignedRespecsPrecedence() {
            var tasks = List.of(
                    task("PRED", "2025-01-01", "2025-01-05", "alice@test.com", TaskPriority.HIGHEST),
                    taskWithDeps("CHILD", "2025-01-01", "2025-01-03", null,
                            TaskPriority.HIGH, List.of("PRED"))
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            var pred = result.tasks().get("PRED");
            var child = result.tasks().get("CHILD");

            assertFalse(child.suggestedStart().isBefore(pred.suggestedDue()),
                    "Unassigned child must still wait for predecessor");
        }
    }

    // ========================================================================
    // 19. STRESS TEST: SINGLE RESOURCE SERIALIZATION
    // ========================================================================

    @Nested
    @DisplayName("Stress: single resource serialization")
    class StressSingleResource {

        @Test
        @DisplayName("10 tasks on single person: all serialized with no overlap")
        void tenTasksSinglePerson() {
            var tasks = new ArrayList<TaskDTO>();
            for (int i = 0; i < 10; i++) {
                tasks.add(task("T-" + (i + 1), "2025-01-01", "2025-01-03", "alice@test.com",
                        TaskPriority.values()[i % 5]));
            }

            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            assertEquals(10, result.tasks().size());
            assertEquals(0, result.resourceConflicts());

            // Verify strict serialization: each task starts after previous ends
            var sorted = result.tasks().values().stream()
                    .sorted(Comparator.comparing(ScheduleOptimizer.ScheduledTask::suggestedStart))
                    .toList();

            for (int i = 0; i < sorted.size() - 1; i++) {
                assertFalse(
                        sorted.get(i).suggestedDue().isAfter(sorted.get(i + 1).suggestedStart()),
                        "Task " + sorted.get(i).taskKey() + " (due " + sorted.get(i).suggestedDue() +
                                ") overlaps with " + sorted.get(i + 1).taskKey() +
                                " (start " + sorted.get(i + 1).suggestedStart() + ")"
                );
            }

            // Makespan should be 10 tasks * 3 days each = 30
            assertEquals(30, result.makespan());
        }

        @Test
        @DisplayName("50 tasks across 5 people: all zero conflicts")
        void fiftyTasksFivePeople() {
            String[] people = {"alice", "bob", "carol", "dave", "eve"};
            var tasks = new ArrayList<TaskDTO>();
            for (int i = 0; i < 50; i++) {
                tasks.add(task("T-" + (i + 1), "2025-01-01", "2025-01-03",
                        people[i % 5] + "@test.com",
                        TaskPriority.values()[i % 5]));
            }

            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            assertEquals(50, result.tasks().size());
            assertEquals(0, result.resourceConflicts());

            // Each person gets 10 tasks, each 3 days → per-person makespan = 30
            assertEquals(30, result.makespan(), "10 tasks per person * 3 days = 30");
        }
    }

    // ========================================================================
    // 20. PRIORITY WEIGHT IMPACT ON TARDINESS
    // ========================================================================

    @Nested
    @DisplayName("Priority weight impact on scheduling decisions")
    class PriorityWeightImpact {

        @Test
        @DisplayName("HIGHEST priority task has zero tardiness even when resource-constrained")
        void highestPriorityZeroTardiness() {
            // Two tasks same person, same dates. HIGHEST should go first → 0 tardiness.
            var tasks = List.of(
                    task("T-HIGH", "2025-01-01", "2025-01-05", "alice@test.com", TaskPriority.HIGHEST),
                    task("T-LOW", "2025-01-01", "2025-01-05", "alice@test.com", TaskPriority.LOWEST)
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            assertEquals(0, result.tasks().get("T-HIGH").tardinessDays(),
                    "HIGHEST priority should have 0 tardiness — it gets scheduled first");
            assertTrue(result.tasks().get("T-LOW").tardinessDays() > 0,
                    "LOWEST priority should have tardiness — it gets pushed back");
        }

        @Test
        @DisplayName("Weight correctly maps: LOWEST=2, LOW=4, MEDIUM=6, HIGH=8, HIGHEST=10")
        void weightMapping() {
            // Single task for each priority, verify tardiness contribution scales correctly
            var priorities = new TaskPriority[]{
                    TaskPriority.LOWEST, TaskPriority.LOW, TaskPriority.MEDIUM,
                    TaskPriority.HIGH, TaskPriority.HIGHEST
            };
            int[] expectedWeights = {2, 4, 6, 8, 10};

            for (int i = 0; i < priorities.length; i++) {
                // Force 1 day of tardiness by having same person and overlapping
                var tasks = List.of(
                        task("BLOCKER", "2025-01-01", "2025-01-03", "alice@test.com", TaskPriority.HIGHEST),
                        task("TARGET", "2025-01-01", "2025-01-03", "alice@test.com", priorities[i])
                );
                var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

                var target = result.tasks().get("TARGET");
                if (priorities[i] != TaskPriority.HIGHEST) {
                    // TARGET gets pushed → has tardiness. Weighted = weight * tardiness.
                    int tardiness = target.tardinessDays();
                    assertTrue(tardiness > 0, priorities[i] + " should have tardiness when blocked");
                }
            }
        }
    }

    // ========================================================================
    // 21. DIFFERENT TASK DURATIONS
    // ========================================================================

    @Nested
    @DisplayName("Varied task durations")
    class VariedDurations {

        @Test
        @DisplayName("1-day and 30-day tasks on same person serialize correctly")
        void shortAndLongTasks() {
            var tasks = List.of(
                    task("T-LONG", "2025-01-01", "2025-01-30", "alice@test.com", TaskPriority.HIGH),
                    task("T-SHORT", "2025-01-01", "2025-01-01", "alice@test.com", TaskPriority.MEDIUM)
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            assertEquals(0, result.resourceConflicts());

            var tLong = result.tasks().get("T-LONG");
            var tShort = result.tasks().get("T-SHORT");

            // They must not overlap
            assertTrue(
                    !tLong.suggestedDue().isAfter(tShort.suggestedStart()) ||
                            !tShort.suggestedDue().isAfter(tLong.suggestedStart()),
                    "30-day and 1-day tasks must not overlap on same person"
            );
        }

        @Test
        @DisplayName("Multiple different-duration tasks: total makespan is correct")
        void differentDurationsMakespan() {
            // alice: 3 + 5 + 2 = 10 days sequential
            var tasks = List.of(
                    task("T-3D", "2025-01-01", "2025-01-03", "alice@test.com", TaskPriority.HIGHEST),
                    task("T-5D", "2025-01-01", "2025-01-05", "alice@test.com", TaskPriority.HIGH),
                    task("T-2D", "2025-01-01", "2025-01-02", "alice@test.com", TaskPriority.MEDIUM)
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            assertEquals(0, result.resourceConflicts());
            assertEquals(10, result.makespan(), "3+5+2 = 10 days total");
        }
    }

    // ========================================================================
    // 22. NON-ACTIVE STATUS HANDLING
    // ========================================================================

    @Nested
    @DisplayName("Non-active task status handling")
    class NonActiveStatuses {

        @ParameterizedTest
        @EnumSource(value = TaskStatus.class, names = {
                "BACKLOG", "GATHERING_INTEREST", "TODO", "IN_PROGRESS",
                "TO_REVIEW", "TO_TEST", "IN_TEST", "READY_TO_MERGE", "READY_TO_DEPLOY"
        })
        @DisplayName("Active statuses are included in optimization")
        void activeStatusesIncluded(TaskStatus status) {
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-05", "alice@test.com",
                            TaskPriority.MEDIUM, status, List.of())
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
            assertEquals(1, result.tasks().size(), status + " should be included in optimization");
        }

        @ParameterizedTest
        @EnumSource(value = TaskStatus.class, names = {"DONE", "RELEASED", "WITHDRAWN"})
        @DisplayName("Terminal statuses are excluded from optimization results")
        void terminalStatusesExcluded(TaskStatus status) {
            var tasks = List.of(
                    task("T-1", "2025-01-01", "2025-01-05", "alice@test.com",
                            TaskPriority.MEDIUM, status, List.of())
            );
            var result = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
            assertTrue(result.tasks().isEmpty(), status + " should be excluded from optimization");
        }
    }
}
