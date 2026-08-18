package com.backend.scheduling;

/**
 * Where a task ended up. {@code end} is exclusive.
 *
 * @param tardiness days past the due date, zero if on time
 */
public record Placement(String key, int start, int end, int tardiness) {

    public boolean overlaps(Placement other) {
        return start < other.end && other.start < end;
    }
}
