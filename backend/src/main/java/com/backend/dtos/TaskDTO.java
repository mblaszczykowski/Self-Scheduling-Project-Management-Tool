package com.backend.dtos;

import java.util.Date;
import java.util.List;

public record TaskDTO(
        Integer id,
        String taskKey,
        String projectKey,
        String summary,
        String description,
        String status,
        Date startDate,
        Date dueDate,
        String assignee,
        List<String> labels,
        List<Integer> dependencies,
        Boolean isCritical,
        List<String> attachments,
        Date created,
        Date updated,
        Integer progress,
        String priority
) {}

