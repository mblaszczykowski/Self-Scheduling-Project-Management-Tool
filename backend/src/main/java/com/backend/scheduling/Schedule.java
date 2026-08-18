package com.backend.scheduling;

import java.util.Collection;
import java.util.Map;

/**
 * A complete assignment of start days to the tasks that were scheduled.
 *
 * @param placements  by task key; contains only the tasks the decoder actually placed
 * @param rule        which priority rule produced it, for reporting
 */
public record Schedule(Map<String, Placement> placements, PriorityRule rule) {

    public Schedule {
        placements = Map.copyOf(placements);
    }

    public Collection<Placement> all() {
        return placements.values();
    }

    public int size() {
        return placements.size();
    }
}
