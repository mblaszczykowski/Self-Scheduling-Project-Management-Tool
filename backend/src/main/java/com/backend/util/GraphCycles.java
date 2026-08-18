package com.backend.util;

import java.util.HashSet;
import java.util.LinkedList;
import java.util.function.Function;

public final class GraphCycles {

    private GraphCycles() {
    }

    public static <T, ID> boolean createsCycle(ID rootId, Iterable<T> candidates,
                                               Function<T, ID> idOf,
                                               Function<T, ? extends Iterable<T>> childrenOf) {
        var visited = new HashSet<ID>();
        var queue = new LinkedList<T>();
        candidates.forEach(queue::add);

        while (!queue.isEmpty()) {
            var current = queue.poll();
            var currentId = idOf.apply(current);
            if (currentId.equals(rootId)) {
                return true;
            }
            if (visited.add(currentId)) {
                childrenOf.apply(current).forEach(queue::add);
            }
        }
        return false;
    }
}
