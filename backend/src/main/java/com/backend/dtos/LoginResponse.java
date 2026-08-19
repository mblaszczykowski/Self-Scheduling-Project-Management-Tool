package com.backend.dtos;

public record LoginResponse(
        String message,
        Integer userId,
        String email,
        String name
) {}
