package com.backend.scheduling;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("CriticalPathAnalyzer")
class CriticalPathAnalyzerTest {
    private static ScheduleTask task(String key, int duration, int dueOffset, String... predecessors) {
        return new ScheduleTask(key, duration, 0, 0, dueOffset, 5, null, List.of(predecessors), false);
    }

    private static ScheduleTask fixed(String key, int start, int duration, String... predecessors) {
        return new ScheduleTask(key, duration, start, start, start + duration, 5, null,
                List.of(predecessors), true);
    }

    @Nested
    @DisplayName("float is slack against the work's own deadline")
    class FloatAgainstDeadlines {
        @Test
        @DisplayName("a task with room before its due date has that much float")
        void roomBeforeTheDueDateIsFloat() {
            var graph = PrecedenceGraph.of(List.of(task("A", 4, 10)));

            var analysis = CriticalPathAnalyzer.analyze(graph);

            assertThat(analysis.totalFloat()).containsEntry("A", 6);
            assertThat(analysis.criticalKeys()).isEmpty();
        }

        @Test
        @DisplayName("a task that must start today to make its date is critical")
        void noRoomIsCritical() {
            var graph = PrecedenceGraph.of(List.of(task("TIGHT", 5, 5)));

            var analysis = CriticalPathAnalyzer.analyze(graph);

            assertThat(analysis.totalFloat()).containsEntry("TIGHT", 0);
            assertThat(analysis.criticalKeys()).containsExactly("TIGHT");
        }

        @Test
        @DisplayName("work that can no longer make its date reports negative float and stays critical")
        void alreadyUnachievableIsCritical() {
            var graph = PrecedenceGraph.of(List.of(task("LATE", 10, 4)));

            var analysis = CriticalPathAnalyzer.analyze(graph);

            assertThat(analysis.totalFloat()).containsEntry("LATE", -6);
            assertThat(analysis.criticalKeys()).containsExactly("LATE");
        }

        @Test
        @DisplayName("a successor that needs an earlier finish tightens its predecessor past its own date")
        void successorTightensPredecessor() {
            var graph = PrecedenceGraph.of(List.of(
                    task("FIRST", 3, 30),
                    task("SECOND", 5, 8, "FIRST")));

            var analysis = CriticalPathAnalyzer.analyze(graph);

            assertThat(analysis.totalFloat()).containsEntry("SECOND", 0).containsEntry("FIRST", 0);
            assertThat(analysis.criticalKeys()).containsExactlyInAnyOrder("FIRST", "SECOND");
        }
    }

    @Nested
    @DisplayName("independent work is not automatically critical")
    class IndependentWork {
        @Test
        @DisplayName("a task with no dependencies is judged on its own deadline, not on being alone")
        void singleTaskIsNotCriticalByDefault() {
            var graph = PrecedenceGraph.of(List.of(
                    task("IND-1", 4, 10), task("IND-2", 4, 11), task("IND-3", 4, 12)));

            var analysis = CriticalPathAnalyzer.analyze(graph);

            assertThat(analysis.criticalKeys()).isEmpty();
            assertThat(analysis.totalFloat())
                    .containsEntry("IND-1", 6).containsEntry("IND-2", 7).containsEntry("IND-3", 8);
        }

        @Test
        @DisplayName("only the genuinely tight task in a chain is critical")
        void onlyTheTightLinkIsCritical() {
            var graph = PrecedenceGraph.of(List.of(
                    task("C1", 5, 5),
                    task("C2", 5, 12, "C1"),
                    task("C3", 5, 20, "C2")));

            var analysis = CriticalPathAnalyzer.analyze(graph);

            assertThat(analysis.criticalKeys()).containsExactly("C1");
            assertThat(analysis.totalFloat())
                    .containsEntry("C1", 0).containsEntry("C2", 2).containsEntry("C3", 5);
        }

        @Test
        @DisplayName("a project analysed alongside a longer one keeps its own verdict")
        void aLongerNeighbourDoesNotChangeTheVerdict() {
            var alone = PrecedenceGraph.of(List.of(task("X-1", 5, 5), task("X-2", 2, 20, "X-1")));
            var aloneAnalysis = CriticalPathAnalyzer.analyze(alone);

            var together = PrecedenceGraph.of(List.of(
                    task("X-1", 5, 5), task("X-2", 2, 20, "X-1"), task("Y-1", 40, 60)));
            var togetherAnalysis = CriticalPathAnalyzer.analyze(together);

            assertThat(togetherAnalysis.totalFloat().get("X-1")).isEqualTo(aloneAnalysis.totalFloat().get("X-1"));
            assertThat(togetherAnalysis.totalFloat().get("X-2")).isEqualTo(aloneAnalysis.totalFloat().get("X-2"));
            assertThat(togetherAnalysis.criticalKeys()).containsExactly("X-1");
        }
    }

    @Nested
    @DisplayName("fixed work constrains but is not scored")
    class FixedWork {
        @Test
        @DisplayName("a completed task is neither given float nor called critical")
        void completedWorkIsNotReported() {
            var graph = PrecedenceGraph.of(List.of(
                    fixed("DONE", -30, 5),
                    task("OPEN", 4, 10)));

            var analysis = CriticalPathAnalyzer.analyze(graph);

            assertThat(analysis.totalFloat()).containsOnlyKeys("OPEN");
            assertThat(analysis.criticalKeys()).doesNotContain("DONE");
        }

        @Test
        @DisplayName("a completed predecessor delays nothing, because it is already finished")
        void completedPredecessorDoesNotDelay() {
            var graph = PrecedenceGraph.of(List.of(
                    fixed("DONE", -30, 5),
                    task("NEXT", 4, 10, "DONE")));

            assertThat(CriticalPathAnalyzer.analyze(graph).totalFloat()).containsEntry("NEXT", 6);
        }

        @Test
        @DisplayName("an anchor still ahead of us pushes its successor out")
        void futureAnchorDelaysItsSuccessor() {
            var graph = PrecedenceGraph.of(List.of(
                    fixed("ANCHOR", 20, 5),
                    task("AFTER", 4, 40, "ANCHOR")));

            assertThat(CriticalPathAnalyzer.analyze(graph).totalFloat()).containsEntry("AFTER", 11);
        }

        @Test
        @DisplayName("a fixed successor does not drag its movable predecessor, matching the decoder")
        void fixedSuccessorDoesNotConstrainItsPredecessor() {
            var graph = PrecedenceGraph.of(List.of(
                    task("OPEN", 20, 25),
                    fixed("ALREADY-DONE", -30, 5, "OPEN")));

            var analysis = CriticalPathAnalyzer.analyze(graph);

            assertThat(analysis.totalFloat()).containsExactly(java.util.Map.entry("OPEN", 5));
            assertThat(analysis.criticalKeys()).isEmpty();
        }
    }

    @Test
    @DisplayName("an empty graph analyses to nothing rather than failing")
    void emptyGraphIsEmpty() {
        assertThat(CriticalPathAnalyzer.analyze(PrecedenceGraph.of(List.of())).criticalKeys()).isEmpty();
    }
}
