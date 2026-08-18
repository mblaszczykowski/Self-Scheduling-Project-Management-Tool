package com.backend.scheduling;

import com.backend.config.AppProperties;
import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;
import com.backend.exception.ValidationException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

import static com.backend.scheduling.ScheduleFixtures.TODAY;
import static com.backend.scheduling.ScheduleFixtures.task;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The invariants that make a produced schedule trustworthy.
 *
 * <p>Assertions here are deliberately <em>strict</em>. The previous suite asserted precedence with
 * {@code !successor.start.isBefore(predecessor.due)} — but a due date is inclusive, so a successor
 * starting exactly on its predecessor's due date is a real one-day overlap, and an off-by-one
 * regression in the decoder would have passed every test in the file.
 */
class SchedulingInvariantsTest {

    private final SchedulingService scheduling = new SchedulingService(new AppProperties());

    // ======================== Feasibility ========================

    @Nested
    @DisplayName("Precedence feasibility")
    class Precedence {

        @Test
        @DisplayName("a successor never starts before its predecessor has finished")
        void successorFollowsPredecessor() {
            var tasks = List.of(
                    task("P-1").from("2026-01-05").to("2026-01-09").assignedTo("a@x").build(),
                    task("P-2").from("2026-01-05").to("2026-01-09").assignedTo("b@x")
                            .dependsOn("P-1").build());

            var outcome = scheduling.optimize(tasks, List.of(), TODAY, 0.8, 0.2);
            assertPrecedenceFeasible(outcome);
        }

        @Test
        @DisplayName("holds even when the successor has far higher priority than the predecessor")
        void priorityCannotOvertakePrecedence() {
            // The defect this pins: scheduling from a single priority-sorted list rather than an
            // eligible set let a high-priority successor be placed before its predecessor.
            var tasks = List.of(
                    task("P-1").priority(TaskPriority.LOWEST).from("2026-01-05").to("2026-01-09")
                            .assignedTo("a@x").build(),
                    task("P-2").priority(TaskPriority.HIGHEST).from("2026-01-05").to("2026-01-06")
                            .assignedTo("b@x").dependsOn("P-1").build());

            var outcome = scheduling.optimize(tasks, List.of(), TODAY, 0.8, 0.2);
            assertPrecedenceFeasible(outcome);

            var predecessor = outcome.chosen().placements().get("P-1");
            var successor = outcome.chosen().placements().get("P-2");
            assertThat(successor.start()).isGreaterThanOrEqualTo(predecessor.end());
        }

        @Test
        @DisplayName("a diamond dependency waits for both branches")
        void diamondWaitsForBothBranches() {
            var tasks = List.of(
                    task("P-1").from("2026-01-05").to("2026-01-06").build(),
                    task("P-2").from("2026-01-05").to("2026-01-06").dependsOn("P-1").build(),
                    task("P-3").from("2026-01-05").to("2026-01-14").dependsOn("P-1").build(),
                    task("P-4").from("2026-01-05").to("2026-01-06").dependsOn("P-2", "P-3").build());

            var outcome = scheduling.optimize(tasks, List.of(), TODAY, 0.8, 0.2);
            assertPrecedenceFeasible(outcome);

            var placements = outcome.chosen().placements();
            assertThat(placements.get("P-4").start())
                    .isGreaterThanOrEqualTo(placements.get("P-3").end())
                    .isGreaterThanOrEqualTo(placements.get("P-2").end());
        }

        @Test
        @DisplayName("a duplicated dependency key does not deadlock the decoder")
        void duplicateDependencyIsHandled() {
            var tasks = List.of(
                    task("P-1").from("2026-01-05").to("2026-01-06").build(),
                    task("P-2").from("2026-01-05").to("2026-01-06").dependsOn("P-1", "P-1").build());

            var outcome = scheduling.optimize(tasks, List.of(), TODAY, 0.8, 0.2);
            assertThat(outcome.chosen().size()).isEqualTo(2);
            assertPrecedenceFeasible(outcome);
        }

        @Test
        @DisplayName("a dependency cycle is rejected rather than mis-scheduled")
        void cycleIsRejected() {
            var tasks = List.of(
                    task("P-1").dependsOn("P-2").build(),
                    task("P-2").dependsOn("P-1").build());

            assertThatThrownBy(() -> scheduling.optimize(tasks, List.of(), TODAY, 0.8, 0.2))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("Circular");
        }

        @Test
        @DisplayName("a self-dependency is rejected")
        void selfDependencyIsRejected() {
            var tasks = List.of(task("P-1").dependsOn("P-1").build());

            assertThatThrownBy(() -> scheduling.optimize(tasks, List.of(), TODAY, 0.8, 0.2))
                    .isInstanceOf(ValidationException.class);
        }

        @Test
        @DisplayName("a predecessor outside the optimized set still constrains it")
        void outsideAnchorIsRespected() {
            // Previously a predecessor that was not loaded contributed nothing at all, so
            // optimizing one project silently violated its cross-project dependencies.
            var anchor = task("OTHER-1").from("2026-01-05").to("2026-01-20").build();
            var tasks = List.of(task("P-1").from("2026-01-05").to("2026-01-09")
                    .dependsOn("OTHER-1").build());

            var outcome = scheduling.optimize(tasks, List.of(anchor), TODAY, 0.8, 0.2);

            var anchorPlacement = outcome.chosen().placements().get("OTHER-1");
            var dependent = outcome.chosen().placements().get("P-1");
            assertThat(dependent.start()).isGreaterThanOrEqualTo(anchorPlacement.end());
        }
    }

    @Nested
    @DisplayName("Resource feasibility")
    class Resources {

        @Test
        @DisplayName("no two tasks of the same person ever overlap")
        void sameAssigneeNeverOverlaps() {
            var tasks = List.of(
                    task("P-1").from("2026-01-05").to("2026-01-14").assignedTo("dev@x").build(),
                    task("P-2").from("2026-01-05").to("2026-01-06").assignedTo("dev@x").build(),
                    task("P-3").from("2026-01-08").to("2026-01-09").assignedTo("dev@x").build());

            var outcome = scheduling.optimize(tasks, List.of(), TODAY, 0.8, 0.2);

            assertResourceFeasible(outcome);
            assertThat(outcome.chosenMetrics().resourceConflicts()).isZero();
            assertThat(outcome.chosenMetrics().feasible()).isTrue();
        }

        @Test
        @DisplayName("unassigned tasks may run in parallel")
        void unassignedTasksRunInParallel() {
            var tasks = List.of(
                    task("P-1").from("2026-01-05").to("2026-01-09").build(),
                    task("P-2").from("2026-01-05").to("2026-01-09").build());

            var outcome = scheduling.optimize(tasks, List.of(), TODAY, 0.8, 0.2);

            var first = outcome.chosen().placements().get("P-1");
            var second = outcome.chosen().placements().get("P-2");
            assertThat(first.start()).isEqualTo(second.start());
        }

        @Test
        @DisplayName("completed work still occupies its assignee")
        void completedWorkBlocksItsAssignee() {
            var tasks = List.of(
                    task("P-1").from("2026-01-05").to("2026-01-14").assignedTo("dev@x")
                            .status(TaskStatus.DONE).build(),
                    task("P-2").from("2026-01-05").to("2026-01-09").assignedTo("dev@x").build());

            var outcome = scheduling.optimize(tasks, List.of(), TODAY, 0.8, 0.2);
            assertResourceFeasible(outcome);
        }
    }

    // ======================== Comparability of before and after ========================

    @Nested
    @DisplayName("Before and after are measured on the same axis")
    class Comparability {

        @Test
        @DisplayName("a plan with nothing to optimize is reported unchanged")
        void nothingToOptimizeChangesNothing() {
            // The defect this pins: the baseline was credited with work already consumed in the
            // past while the candidate was charged for it in full, so a single overdue task with no
            // contention was reported as having got twice as bad.
            var tasks = List.of(task("P-1").priority(TaskPriority.HIGHEST)
                    .from("2025-12-22").to("2025-12-26").assignedTo("dev@x").build());

            var outcome = scheduling.optimize(tasks, List.of(), TODAY, 0.8, 0.2);

            assertThat(outcome.chosenMetrics().weightedTardiness())
                    .isEqualTo(outcome.currentMetrics().weightedTardiness());
            assertThat(outcome.chosenMetrics().makespan()).isEqualTo(outcome.currentMetrics().makespan());
            assertThat(outcome.chosenMetrics().objectiveValue())
                    .isEqualTo(outcome.currentMetrics().objectiveValue());
        }

        @Test
        @DisplayName("a feasible plan is never made worse")
        void feasiblePlanIsNeverMadeWorse() {
            var tasks = List.of(
                    task("P-1").from("2026-02-02").to("2026-02-06").assignedTo("a@x").build(),
                    task("P-2").from("2026-02-09").to("2026-02-13").assignedTo("a@x").build(),
                    task("P-3").from("2026-02-02").to("2026-02-06").assignedTo("b@x").build());

            var outcome = scheduling.optimize(tasks, List.of(), TODAY, 0.8, 0.2);

            assertThat(outcome.chosenMetrics().objectiveValue())
                    .isLessThanOrEqualTo(outcome.currentMetrics().objectiveValue());
        }

        @Test
        @DisplayName("the current plan's conflicts are reported, not hidden")
        void currentPlanConflictsAreReported() {
            var tasks = List.of(
                    task("P-1").from("2026-02-02").to("2026-02-13").assignedTo("dev@x").build(),
                    task("P-2").from("2026-02-02").to("2026-02-06").assignedTo("dev@x").build());

            var outcome = scheduling.optimize(tasks, List.of(), TODAY, 0.8, 0.2);

            assertThat(outcome.currentMetrics().resourceConflicts()).isEqualTo(1);
            assertThat(outcome.currentMetrics().feasible()).isFalse();
            assertThat(outcome.chosenMetrics().resourceConflicts()).isZero();
        }
    }

    // ======================== Modelling ========================

    @Nested
    @DisplayName("Modelling")
    class Modelling {

        @Test
        @DisplayName("a task planned for the future is not dragged to today")
        void futureWorkKeepsItsReleaseDate() {
            var tasks = List.of(task("P-1").from("2026-06-01").to("2026-06-10").build());

            var outcome = scheduling.optimize(tasks, List.of(), TODAY, 0.8, 0.2);

            var placement = outcome.chosen().placements().get("P-1");
            assertThat(TODAY.plusDays(placement.start())).isEqualTo(LocalDate.of(2026, 6, 1));
        }

        @Test
        @DisplayName("progress shortens the remaining work")
        void progressShortensRemainingWork() {
            var almostDone = List.of(task("P-1").from("2026-02-02").to("2026-02-11")
                    .progress(90).build());
            var untouched = List.of(task("P-1").from("2026-02-02").to("2026-02-11")
                    .progress(0).build());

            int remaining = span(scheduling.optimize(almostDone, List.of(), TODAY, 0.8, 0.2));
            int full = span(scheduling.optimize(untouched, List.of(), TODAY, 0.8, 0.2));

            assertThat(remaining).isEqualTo(1);
            assertThat(full).isEqualTo(10);
        }

        @Test
        @DisplayName("overdue work starts today rather than in the past")
        void overdueWorkStartsToday() {
            var tasks = List.of(task("P-1").from("2025-11-01").to("2025-11-10").build());

            var outcome = scheduling.optimize(tasks, List.of(), TODAY, 0.8, 0.2);

            assertThat(outcome.chosen().placements().get("P-1").start()).isZero();
        }

        @Test
        @DisplayName("a task with no dates is skipped and reported")
        void datelessTaskIsReported() {
            var dated = task("P-1").from("2026-02-02").to("2026-02-06").build();
            var undated = new com.backend.dtos.TaskDTO(null, null, "P-2", "P", "P-2", null,
                    TaskStatus.TODO, null, null, null, List.of(), List.of(), null, List.of(),
                    null, null, 0, TaskPriority.MEDIUM);

            var outcome = scheduling.optimize(List.of(dated, undated), List.of(), TODAY, 0.8, 0.2);

            assertThat(outcome.skippedKeys()).containsExactly("P-2");
            assertThat(outcome.chosen().placements()).containsOnlyKeys("P-1");
        }
    }

    // ======================== Objective ========================

    @Nested
    @DisplayName("Objective value")
    class Objective {

        @Test
        @DisplayName("stays within [0, 1] even for a badly over-committed portfolio")
        void objectiveIsBounded() {
            // The defect this pins: normalising weighted tardiness by total processing time has no
            // upper bound, and a "normalised" Z was measured at 23.9.
            var tasks = new ArrayList<com.backend.dtos.TaskDTO>();
            for (int i = 1; i <= 60; i++) {
                tasks.add(task("P-" + i).from("2026-01-05").to("2026-04-04")
                        .assignedTo("only@x").priority(TaskPriority.HIGHEST).build());
            }

            var outcome = scheduling.optimize(tasks, List.of(), TODAY, 0.7, 0.3);

            assertThat(outcome.chosenMetrics().objectiveValue()).isBetween(0.0, 1.0);
            assertThat(outcome.currentMetrics().objectiveValue()).isBetween(0.0, 1.0);
        }

        @Test
        @DisplayName("the chosen schedule is no worse than any single rule")
        void chosenIsArgminAcrossRules() {
            var tasks = List.of(
                    task("P-1").from("2026-01-05").to("2026-01-16").assignedTo("dev@x")
                            .priority(TaskPriority.LOWEST).build(),
                    task("P-2").from("2026-01-05").to("2026-01-07").assignedTo("dev@x")
                            .priority(TaskPriority.HIGHEST).build(),
                    task("P-3").from("2026-01-05").to("2026-01-09").assignedTo("dev@x")
                            .priority(TaskPriority.HIGH).build());

            var outcome = scheduling.optimize(tasks, List.of(), TODAY, 0.8, 0.2);

            assertThat(outcome.metricsByRule()).isNotEmpty();
            for (var metrics : outcome.metricsByRule().values()) {
                assertThat(outcome.chosenMetrics().objectiveValue())
                        .isLessThanOrEqualTo(metrics.objectiveValue());
            }
        }

        @Test
        @DisplayName("the weights actually change which schedule is chosen")
        void weightsSelectBetweenRules() {
            var tasks = List.of(
                    task("P-1").from("2026-01-05").to("2026-01-16").assignedTo("dev@x")
                            .priority(TaskPriority.LOWEST).build(),
                    task("P-2").from("2026-01-05").to("2026-01-07").assignedTo("dev@x")
                            .priority(TaskPriority.HIGHEST).build(),
                    task("P-3").from("2026-01-05").to("2026-01-09").assignedTo("dev@x")
                            .priority(TaskPriority.HIGH).build());

            var tardinessFocused = scheduling.optimize(tasks, List.of(), TODAY, 1.0, 0.0);
            var makespanFocused = scheduling.optimize(tasks, List.of(), TODAY, 0.0, 1.0);

            // Both must be feasible, and each must be the best available under its own weighting.
            assertThat(tardinessFocused.chosenMetrics().feasible()).isTrue();
            assertThat(makespanFocused.chosenMetrics().feasible()).isTrue();
            for (var metrics : tardinessFocused.metricsByRule().values()) {
                assertThat(tardinessFocused.chosenMetrics().objectiveValue())
                        .isLessThanOrEqualTo(metrics.objectiveValue());
            }
        }
    }

    // ======================== Determinism ========================

    @Test
    @DisplayName("the same input produces the same schedule regardless of input order")
    void resultIsOrderIndependent() {
        var tasks = new ArrayList<com.backend.dtos.TaskDTO>();
        for (int i = 1; i <= 12; i++) {
            tasks.add(task("P-" + i)
                    .from("2026-01-05").to("2026-01-0" + (5 + (i % 4)))
                    .assignedTo("dev" + (i % 3) + "@x")
                    .priority(TaskPriority.values()[i % TaskPriority.values().length])
                    .build());
        }

        var reference = scheduling.optimize(tasks, List.of(), TODAY, 0.8, 0.2);

        var shuffled = new ArrayList<>(tasks);
        Collections.shuffle(shuffled, new Random(7));
        var other = scheduling.optimize(shuffled, List.of(), TODAY, 0.8, 0.2);

        assertThat(other.chosen().placements()).isEqualTo(reference.chosen().placements());
        assertThat(other.chosenMetrics()).isEqualTo(reference.chosenMetrics());
    }

    @Test
    @DisplayName("the reported conflict count does not depend on input order")
    void conflictCountIsOrderInvariant() {
        // The defect this pins: counting "clashes with an earlier-iterated task" reported 2, 1 or 2
        // conflicts for the same three overlapping tasks depending on the order they arrived in.
        var a = task("P-1").from("2026-02-02").to("2026-02-11").assignedTo("dev@x").build();
        var b = task("P-2").from("2026-02-02").to("2026-02-03").assignedTo("dev@x").build();
        var c = task("P-3").from("2026-02-05").to("2026-02-06").assignedTo("dev@x").build();

        int first = scheduling.optimize(List.of(a, b, c), List.of(), TODAY, 0.8, 0.2)
                .currentMetrics().resourceConflicts();
        int second = scheduling.optimize(List.of(b, c, a), List.of(), TODAY, 0.8, 0.2)
                .currentMetrics().resourceConflicts();
        int third = scheduling.optimize(List.of(c, a, b), List.of(), TODAY, 0.8, 0.2)
                .currentMetrics().resourceConflicts();

        assertThat(first).isEqualTo(second).isEqualTo(third).isEqualTo(2);
    }

    // ======================== Helpers ========================

    private static int span(SchedulingService.Outcome outcome) {
        var placement = outcome.chosen().placements().get("P-1");
        return placement.end() - placement.start();
    }

    /** Strict: a successor must start on a day strictly after its predecessor's last worked day. */
    private static void assertPrecedenceFeasible(SchedulingService.Outcome outcome) {
        var graph = outcome.graph();
        for (var placement : outcome.chosen().all()) {
            for (var predecessorKey : graph.knownPredecessorsOf(placement.key())) {
                var predecessor = outcome.chosen().placements().get(predecessorKey);
                assertThat(placement.start())
                        .as("%s must start at or after %s ends", placement.key(), predecessorKey)
                        .isGreaterThanOrEqualTo(predecessor.end());
            }
        }
    }

    /** Strict: every pair of same-assignee placements is checked, not just adjacent ones. */
    private static void assertResourceFeasible(SchedulingService.Outcome outcome) {
        var placements = new ArrayList<>(outcome.chosen().all());
        for (int i = 0; i < placements.size(); i++) {
            for (int j = i + 1; j < placements.size(); j++) {
                var first = placements.get(i);
                var second = placements.get(j);
                var firstTask = outcome.graph().task(first.key());
                var secondTask = outcome.graph().task(second.key());
                if (!firstTask.hasAssignee() || !firstTask.assignee().equals(secondTask.assignee())) {
                    continue;
                }
                assertThat(first.overlaps(second))
                        .as("%s and %s share %s and must not overlap",
                                first.key(), second.key(), firstTask.assignee())
                        .isFalse();
            }
        }
    }
}
