package com.backend.scheduling;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CriticalPathAnalyzerTest {

    private static ScheduleTask node(String key, int duration, String... predecessors) {
        return new ScheduleTask(key, duration, 0, 0, duration, 5, null, List.of(predecessors), false);
    }

    @Test
    @DisplayName("the longest chain is critical and a slack branch is not")
    void longestChainIsCritical() {
        var graph = PrecedenceGraph.of(List.of(
                node("A", 3),
                node("LONG", 10, "A"),
                node("SHORT", 2, "A"),
                node("END", 1, "LONG", "SHORT")));

        var critical = CriticalPathAnalyzer.criticalTaskKeys(graph);

        assertThat(critical).containsExactlyInAnyOrder("A", "LONG", "END");
        assertThat(critical).doesNotContain("SHORT");
    }

    @Test
    @DisplayName("each project keeps its own critical path when analysed alongside another")
    void componentsHaveIndependentFinishTimes() {
        // The defect this pins: one global project finish across everything analysed together meant
        // that whenever two projects were optimized at once, every project but the longest lost its
        // critical path entirely.
        var alone = PrecedenceGraph.of(List.of(node("X-1", 3), node("X-2", 2, "X-1")));
        assertThat(CriticalPathAnalyzer.criticalTaskKeys(alone)).containsExactlyInAnyOrder("X-1", "X-2");

        var together = PrecedenceGraph.of(List.of(
                node("X-1", 3), node("X-2", 2, "X-1"), node("Y-1", 20)));

        assertThat(CriticalPathAnalyzer.criticalTaskKeys(together))
                .containsExactlyInAnyOrder("X-1", "X-2", "Y-1");
    }

    @Test
    @DisplayName("total float measures the slack on a non-critical branch")
    void totalFloatMeasuresSlack() {
        var graph = PrecedenceGraph.of(List.of(
                node("A", 1), node("LONG", 10, "A"), node("SHORT", 4, "A"),
                node("END", 1, "LONG", "SHORT")));

        var analysis = CriticalPathAnalyzer.analyze(graph);

        assertThat(analysis.totalFloat().get("LONG")).isZero();
        assertThat(analysis.totalFloat().get("SHORT")).isEqualTo(6);
    }
}
