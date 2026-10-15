package com.backend.web;

import com.backend.exception.ValidationException;
import com.backend.requests.UpdateProfileRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RequestValidatorTest {
    @Test
    void treatsJsonNullAsAnInvalidRequestRatherThanAnInternalServerError() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = new RequestValidator(new ObjectMapper(), factory.getValidator());
            assertThatThrownBy(() -> validator.parseAndValidate("null", UpdateProfileRequest.class))
                    .isInstanceOf(ValidationException.class).hasMessageContaining("JSON object");
        }
    }
}
