package com.backend.dtos;

/** Body of a successful login or registration. The credentials themselves travel as cookies. */
public record LoginResponse(
        String message,
        Integer userId,
        String email,
        String name
) {}
