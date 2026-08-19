package com.backend.scheduling;

public record Placement(String key, int start, int end, int tardiness) {
    public boolean overlaps(Placement other) {
        return start < other.end && other.start < end;
    }
}
