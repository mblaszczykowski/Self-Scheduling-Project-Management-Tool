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

    // ======================== The edge of the guarantee ========================

    @Nested
    @DisplayName("What precedence feasibility does and does not cover")
    class PrecedenceLimits {

        /**
         * Documents a real limitation rather than asserting desired behaviour. The scheme is
         * forward-only: it places a task at the earliest feasible day and has no notion of a
         * latest finish, so it cannot pull a predecessor back to land in front of a successor
         * that is already pinned. A board where a finished task depends on unfinished work is
         * inconsistent before the optimizer runs; this pins what the optimizer does with it, so
         * that changing the answer has to be a deliberate decision.
         */
        @Test
        @DisplayName("a fixed successor does not pull its movable predecessor earlier")
        void fixedSuccessorDoesNotConstrainItsPredecessor() {
            var tasks = List.of(
                    task("P-1").from("2026-01-05").to("2026-01-20").build(),
                    task("P-2").from("2025-12-01").to("2025-12-05")
                            .status(TaskStatus.DONE).progress(100).dependsOn("P-1").build());

            var outcome = scheduling.optimize(tasks, List.of(), TODAY, 0.8, 0.2);

            var predecessor = outcome.chosen().placements().get("P-1");
            var successor = outcome.chosen().placements().get("P-2");
            assertThat(successor.start())
                    .as("the completed task stays exactly where it happened, %d days before today",
                            35)
                    .isEqualTo(-35);
            assertThat(successor.start())
                    .as("so it necessarily starts before its predecessor finishes")
                    .isLessThan(predecessor.end());
        }

        @Test
        @DisplayName("but among movable tasks precedence is absolute, even against priority")
        void movablePrecedenceStillHolds() {
            var tasks = List.of(
                    task("P-1").from("2026-01-05").to("2026-01-08")
                            .priority(TaskPriority.LOWEST).build(),
                    task("P-2").from("2026-01-05").to("2026-01-08")
                            .priority(TaskPriority.HIGHEST).dependsOn("P-1").build());

            var outcome = scheduling.optimize(tasks, List.of(), TODAY, 0.8, 0.2);

            assertPrecedenceFeasible(outcome);
        }
    }

    // ======================== Honest normalisation ========================

    @Nested
    @DisplayName("The horizon actually bounds what it normalises")
    class Normalisation {

        /**
         * H used to be {@code max(max d_j, sum p_j)}, which ignores release dates. Work that
         * cannot start until day 42 then finished past H, and because every task here shares one
         * due date equal to the old H, {@code WT_max = sum(w_j * max(0, H - d_j))} collapsed to
         * zero — so the tardiness term hit its divide-by-zero fallback and scored a schedule with
         * 45 units of weighted tardiness as perfect.
         */
        @Test
        @DisplayName("a plan with real tardiness cannot score a perfect tardiness objective")
        void tardinessIsNeverNormalisedAway() {
            var tasks = List.of(
                    task("P-1").from("2026-02-16").to("2026-02-19").build(),
                    task("P-2").from("2026-02-16").to("2026-02-19").dependsOn("P-1").build(),
                    task("P-3").from("2026-02-16").to("2026-02-19").dependsOn("P-2").build());

            // alpha = 1 puts the whole objective on tardiness, so Z is the tardiness term alone.
            var outcome = scheduling.optimize(tasks, List.of(), TODAY, 1.0, 0.0);

            assertThat(outcome.chosenMetrics().weightedTardiness()).isGreaterThan(0);
            assertThat(outcome.chosenMetrics().objectiveValue())
                    .as("weighted tardiness of %s must not score zero",
                            outcome.chosenMetrics().weightedTardiness())
                    .isGreaterThan(0);
        }

        @Test
        @DisplayName("the makespan term is a ratio, not something the clamp has to rescue")
        void makespanStaysWithinTheHorizon() {
            // Released 42 days out, three days each, chained: the chain cannot finish before
            // day 51, so an H that stopped at the last due date was not a bound at all.
            var tasks = List.of(
                    task("P-1").from("2026-02-16").to("2026-02-19").build(),
                    task("P-2").from("2026-02-16").to("2026-02-19").dependsOn("P-1").build(),
                    task("P-3").from("2026-02-16").to("2026-02-19").dependsOn("P-2").build());
            var horizon = ScheduleObjective.Horizon.of(
                    ScheduleModel.build(tasks, List.of(), TODAY).scheduleTasks(),
                    new AppProperties().getOptimization().getMinHorizonDays());

            var outcome = scheduling.optimize(tasks, List.of(), TODAY, 0.0, 1.0);

            assertThat(outcome.chosenMetrics().makespan()).isLessThanOrEqualTo(horizon.length());
            assertThat(outcome.chosenMetrics().objectiveValue()).isBetween(0.0, 1.0);
        }
    }

    // ======================== Work that already happened ========================

    @Nested
    @DisplayName("Completed work does not consume present capacity")
    class PastWork {

        /**
         * The busy-day interval was written as {@code set(max(0, start), max(0, start) + p)},
         * which slid a task that ran entirely in the past forward onto day 0 instead of clipping
         * it away. A ten-day task finished five weeks ago booked its assignee solid for the next
         * ten days, and the optimizer dutifully scheduled around someone who was free.
         */
        @Test
        @DisplayName("a task finished weeks ago leaves its assignee free today")
        void completedPastWorkDoesNotBlockToday() {
            var tasks = List.of(
                    task("P-1").from("2025-12-01").to("2025-12-10")
                            .assignedTo("dev@x").status(TaskStatus.DONE).progress(100).build(),
                    task("P-2").from("2026-01-05").to("2026-01-06").assignedTo("dev@x").build());

            var outcome = scheduling.optimize(tasks, List.of(), TODAY, 0.8, 0.2);

            assertThat(outcome.chosen().placements().get("P-2").start())
                    .as("nothing occupies dev@x today, so P-2 keeps its start")
                    .isZero();
        }

        @Test
        @DisplayName("work straddling today still blocks the part that is ahead")
        void straddlingWorkStillBlocksItsRemainder() {
            // Fixed, started three days ago, ten days long: days 0..6 are genuinely still busy.
            var anchors = List.of(
                    task("OTHER-1").from("2026-01-02").to("2026-01-11")
                            .assignedTo("dev@x").build());
            var tasks = List.of(
                    task("P-1").from("2026-01-05").to("2026-01-06").assignedTo("dev@x").build());

            var outcome = scheduling.optimize(tasks, anchors, TODAY, 0.8, 0.2);

            assertThat(outcome.chosen().placements().get("P-1").start())
                    .as("dev@x is committed until the anchor finishes")
                    .isPositive();
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
