package com.backend.dtos;

import com.backend.entities.TaskActivityType;
import java.time.Instant;

public record TaskActivityDTO(
        Integer id,
        TaskActivityType type,
        String fieldName,
        String oldValue,
        String newValue,
        String authorName,
        String authorProfilePicture,
        Instant timestamp
) {}
