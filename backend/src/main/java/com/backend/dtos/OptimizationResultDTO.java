package com.backend.dtos;

import java.util.List;

/**
 * @param originalMetrics  the current plan, measured on the same day axis as the proposal
 * @param optimizedMetrics the proposal
 * @param chosenRule       which priority rule won, and why it is worth showing: the weights select
 *                         between rules rather than tuning a single one
 * @param skippedTaskKeys  tasks left out because they have no start or due date. Reported so the
 *                         count in the UI can be explained instead of silently not adding up.
 */
public record OptimizationResultDTO(
        List<TaskScheduleSuggestionDTO> suggestions,
        OptimizationMetricsDTO originalMetrics,
        OptimizationMetricsDTO optimizedMetrics,
        int tasksShifted,
        String chosenRule,
        List<String> skippedTaskKeys
) {}
