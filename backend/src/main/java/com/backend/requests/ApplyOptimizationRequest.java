package com.backend.requests;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
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

        @DecimalMin(value = "0.0", message = "alpha must be between 0 and 1")
        @DecimalMax(value = "1.0", message = "alpha must be between 0 and 1")
        Double alpha,

        @DecimalMin(value = "0.0", message = "beta must be between 0 and 1")
        @DecimalMax(value = "1.0", message = "beta must be between 0 and 1")
        Double beta,

        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate horizonStart,

        @Size(max = 5000, message = "Too many tasks in one request")
        List<String> acceptedTaskKeys
) {}
