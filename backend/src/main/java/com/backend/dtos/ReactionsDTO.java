package com.backend.dtos;

import java.util.List;

public record ReactionsDTO(
        List<String> likedByUsernames,
        List<String> dislikedByUsernames
) {}
