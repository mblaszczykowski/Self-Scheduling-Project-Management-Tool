package com.backend.scheduling;

import com.backend.exception.ValidationException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PrecedenceGraphTest {
    private static ScheduleTask node(String key, String... predecessors) {
        return new ScheduleTask(key, 1, 0, 0, 1, 5, null, List.of(predecessors), false);
    }

    @Test
    @DisplayName("topological order puts every predecessor before its dependents")
    void topologicalOrderRespectsDependencies() {
        var graph = PrecedenceGraph.of(List.of(
                node("C", "B"), node("B", "A"), node("A"), node("D", "A")));

        var order = graph.topologicalOrder();
        assertThat(order.indexOf("A")).isLessThan(order.indexOf("B"));
        assertThat(order.indexOf("B")).isLessThan(order.indexOf("C"));
        assertThat(order.indexOf("A")).isLessThan(order.indexOf("D"));
    }

    @Test
    @DisplayName("transitive successor counts do not double-count a diamond")
    void diamondIsCountedOnce() {
        var graph = PrecedenceGraph.of(List.of(
                node("A"), node("B", "A"), node("C", "A"), node("D", "B", "C")));

        assertThat(graph.transitiveSuccessorCounts())
                .containsEntry("A", 3)
                .containsEntry("B", 1)
                .containsEntry("C", 1)
                .containsEntry("D", 0);
    }

    @Test
    @DisplayName("a predecessor outside the graph imposes no ordering")
    void unknownPredecessorIsIgnored() {
        var graph = PrecedenceGraph.of(List.of(node("A", "NOT-LOADED")));

        assertThat(graph.knownPredecessorsOf("A")).isEmpty();
        assertThat(graph.topologicalOrder()).containsExactly("A");
    }

    @Test
    @DisplayName("a cycle is rejected at construction")
    void cycleIsRejected() {
        assertThatThrownBy(() -> PrecedenceGraph.of(List.of(node("A", "B"), node("B", "A"))))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("Circular");
    }
}
