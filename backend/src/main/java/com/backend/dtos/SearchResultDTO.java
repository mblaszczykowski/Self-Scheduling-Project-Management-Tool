package com.backend.dtos;

import com.backend.entities.User;

import java.util.Date;

public record SearchResultDTO(
        String type, // "project" or "task"
        Integer id,
        String summary,
        String projectKey,
        User assignee,
        Date dueDate
) {}

