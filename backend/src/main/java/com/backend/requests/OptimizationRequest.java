package com.backend.requests;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

/**
 * Inputs to a schedule simulation.
 *
 * <p>{@code alpha} and {@code beta} weigh weighted tardiness against makespan; omitting them uses
 * the configured defaults. {@code horizonStart} is day 0 of the model and defaults to today — it is
 * range-checked in the service, because an unbounded value let a caller ask for (and then persist)
 * suggested dates in the year 1000.
 */
public record OptimizationRequest(
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
        LocalDate horizonStart
) {}
