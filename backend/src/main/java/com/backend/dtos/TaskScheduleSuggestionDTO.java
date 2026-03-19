package com.backend.dtos;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.LocalDate;

public record TaskScheduleSuggestionDTO(
        String taskKey,
        String projectKey,
        String summary,
        String assignee,
        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate originalStartDate,
        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate originalDueDate,
        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate suggestedStartDate,
        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate suggestedDueDate,
        int priorityWeight,
        int tardinessDays,
        boolean isCritical,
        boolean wasShifted
) {}
