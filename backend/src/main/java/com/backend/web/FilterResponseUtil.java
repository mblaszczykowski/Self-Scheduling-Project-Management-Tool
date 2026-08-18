package com.backend.web;

import com.backend.dtos.ApiError;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

import java.io.IOException;

/**
 * Error responses for the servlet filters, which run before Spring MVC and so cannot go through
 * {@code GlobalExceptionHandler}. Emits the same {@link ApiError} body so the two paths agree.
 */
public final class FilterResponseUtil {

    private FilterResponseUtil() {}

    public static void sendJsonError(HttpServletResponse response, HttpStatus status,
                                     String message, ObjectMapper objectMapper) throws IOException {
        sendJsonError(response, status, message, objectMapper, null);
    }

    public static void sendJsonError(HttpServletResponse response, HttpStatus status,
                                     String message, ObjectMapper objectMapper,
                                     String code) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getWriter(),
                ApiError.of(status.value(), status.getReasonPhrase(), message, code));
    }
}
