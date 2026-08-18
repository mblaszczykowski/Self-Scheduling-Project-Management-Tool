package com.backend.web;

import com.backend.exception.ValidationException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validator;
import org.springframework.stereotype.Component;

import java.util.stream.Collectors;

@Component
public class RequestValidator {

    private final ObjectMapper objectMapper;
    private final Validator validator;

    public RequestValidator(ObjectMapper objectMapper, Validator validator) {
        this.objectMapper = objectMapper;
        this.validator = validator;
    }

    public <T> T parseAndValidate(String json, Class<T> type) throws JsonProcessingException {
        var obj = objectMapper.readValue(json, type);
        var violations = validator.validate(obj);
        if (!violations.isEmpty()) {
            var message = violations.stream()
                    .map(v -> v.getMessage())
                    .collect(Collectors.joining("; "));
            throw new ValidationException(message);
        }
        return obj;
    }
}
