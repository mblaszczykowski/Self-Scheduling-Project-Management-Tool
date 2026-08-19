package com.backend.scheduling;

import java.util.Collection;
import java.util.Map;

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
