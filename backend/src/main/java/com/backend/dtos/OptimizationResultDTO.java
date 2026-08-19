package com.backend.dtos;

import java.util.List;

public record OptimizationResultDTO(
        List<TaskScheduleSuggestionDTO> suggestions,
        OptimizationMetricsDTO originalMetrics,
        OptimizationMetricsDTO optimizedMetrics,
        int tasksShifted,
        String chosenRule,
        List<String> skippedTaskKeys
) {}
