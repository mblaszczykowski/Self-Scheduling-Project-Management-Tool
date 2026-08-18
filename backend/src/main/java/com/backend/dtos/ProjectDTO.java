package com.backend.dtos;

import java.time.Instant;
import java.util.List;

public record ProjectDTO(
        Integer id,
        String projectKey,
        String summary,
        String description,
        List<TaskDTO> tasks,
        List<UserDTO> members,
        List<String> attachments,
        UserDTO owner,
        List<String> dependencies,
        Instant created,
        Instant updated
) {}
