package com.backend.util;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

public final class FilterResponseUtil {
    private FilterResponseUtil() {}

    public static void sendJsonError(HttpServletResponse response, HttpStatus status, String message, ObjectMapper objectMapper, Map<String, Object> extra) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        var body = new LinkedHashMap<String, Object>();
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message);
        body.put("timestamp", System.currentTimeMillis());
        if (extra != null) body.putAll(extra);
        objectMapper.writeValue(response.getWriter(), body);
    }

    public static void sendJsonError(HttpServletResponse response, HttpStatus status, String message, ObjectMapper objectMapper) throws IOException {
        sendJsonError(response, status, message, objectMapper, null);
    }
}
