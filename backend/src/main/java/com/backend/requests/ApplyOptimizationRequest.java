package com.backend.requests;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Applies an optimization by re-deriving it server-side.
 *
 * <p>The endpoint deliberately does not accept dates. It takes the same inputs as
 * {@code /simulate}, recomputes the schedule, and persists that — so what lands in the database
 * is feasible by construction, and a stale suggestion set (a dependency edited between simulate
 * and apply) cannot be written. {@code acceptedTaskKeys} narrows which of the recomputed shifts
 * to apply; omitting it applies all of them.
 */
public record ApplyOptimizationRequest(
        @NotEmpty(message = "At least one project key is required")
        @Size(max = 50, message = "At most 50 projects can be optimized at once")
        List<String> projectKeys,

        Double alpha,
        Double beta,
        java.time.LocalDate horizonStart,

        @Size(max = 5000, message = "Too many tasks in one request")
        List<String> acceptedTaskKeys
) {}
