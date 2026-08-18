package com.backend.dtos;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;

/**
 * The single error shape for the whole API. Servlet filters (which run before Spring MVC) and
 * {@code GlobalExceptionHandler} both emit this, so a client has exactly one error contract to
 * model — previously the two paths disagreed on the type of {@code timestamp}.
 */
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
