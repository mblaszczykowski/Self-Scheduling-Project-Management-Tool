package com.backend.dtos;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiError(
        int status,
        String error,
        String message,
        List<FieldError> fieldErrors,
        Instant timestamp
) {
    public ApiError(int status, String error, String message) {
        this(status, error, message, null, Instant.now());
    }

    public record FieldError(String field, String message) {}
}
