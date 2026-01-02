package com.backend.dtos;

import java.util.List;

public record ProjectDTO(
        Integer id,
        String projectKey,
        String summary,
        String description,
        List<TaskDTO> tasks,
        List<UserDTO> members,      // Renamed from 'users'
        List<String> attachments,
        UserDTO owner,
        List<String> dependencies
) {}