package com.backend.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("GraphCycles")
class GraphCyclesTest {

    private record Node(Integer id, List<Integer> childIds) {
    }

    private static boolean createsCycle(Integer rootId, List<Integer> candidateIds, Map<Integer, Node> byId) {
        var candidates = candidateIds.stream().map(byId::get).toList();
        return GraphCycles.createsCycle(rootId, candidates, Node::id,
                node -> node.childIds().stream().map(byId::get).toList());
    }

    @Test
    @DisplayName("reports no cycle for an empty candidate list")
    void reportsNoCycleForEmptyCandidates() {
        assertThat(createsCycle(1, List.of(), Map.of())).isFalse();
    }

    @Test
    @DisplayName("reports no cycle for a diamond-shaped, non-circular graph")
    void reportsNoCycleForADiamond() {
        var byId = Map.of(
                1, new Node(1, List.of()),
                2, new Node(2, List.of(1)),
                3, new Node(3, List.of(1)),
                4, new Node(4, List.of(2, 3)));

        assertThat(createsCycle(4, List.of(2, 3), byId)).isFalse();
    }

    @Test
    @DisplayName("reports a cycle when a candidate is the root itself")
    void reportsADirectSelfCycle() {
        var byId = Map.of(1, new Node(1, List.of()));

        assertThat(createsCycle(1, List.of(1), byId)).isTrue();
    }

    @Test
    @DisplayName("reports a cycle reachable several hops away")
    void reportsAnIndirectCycle() {
        var byId = Map.of(
                1, new Node(1, List.of()),
                2, new Node(2, List.of(3)),
                3, new Node(3, List.of(1)));

        assertThat(createsCycle(1, List.of(2), byId)).isTrue();
    }

    @Test
    @DisplayName("does not revisit an already-seen node forever")
    void terminatesOnASharedDiamondWithoutLooping() {
        var byId = Map.of(
                1, new Node(1, List.of(2, 3)),
                2, new Node(2, List.of(4)),
                3, new Node(3, List.of(4)),
                4, new Node(4, List.of()));

        assertThat(createsCycle(99, List.of(1), byId)).isFalse();
    }
}
