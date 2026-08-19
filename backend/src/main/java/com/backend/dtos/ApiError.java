package com.backend.dtos;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiError(
        int status,
        String error,
        String message,
        String code,
        List<FieldError> fieldErrors,
        Instant timestamp
) {
    public static ApiError of(int status, String error, String message) {
        return new ApiError(status, error, message, null, null, Instant.now());
    }

    public static ApiError of(int status, String error, String message, String code) {
        return new ApiError(status, error, message, code, null, Instant.now());
    }

    public static ApiError withFieldErrors(int status, String error, String message,
                                          List<FieldError> fieldErrors) {
        return new ApiError(status, error, message, null, fieldErrors, Instant.now());
    }

    public record FieldError(String field, String message) {}
}
