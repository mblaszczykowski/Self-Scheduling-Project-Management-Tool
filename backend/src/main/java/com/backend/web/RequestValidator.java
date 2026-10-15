package com.backend.web;

import com.backend.exception.ValidationException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validator;
import org.springframework.stereotype.Component;

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
        if (obj == null) {
            throw new ValidationException("Request body must be a JSON object");
        }
        var violations = validator.validate(obj);
        if (!violations.isEmpty()) {
            throw new ConstraintViolationException(violations);
        }
        return obj;
    }
}
