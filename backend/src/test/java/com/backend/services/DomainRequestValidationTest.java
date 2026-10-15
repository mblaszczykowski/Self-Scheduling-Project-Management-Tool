package com.backend.services;

import com.backend.requests.ApplyOptimizationRequest;
import com.backend.requests.OptimizationRequest;
import com.backend.requests.TaskRequest;
import com.backend.requests.TaskScheduleRequest;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DomainRequestValidationTest {
    @Test
    void optimizationKeysCannotContainNullBlankOrMalformedValues() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            for (var key : Arrays.asList(null, "", " ", "lowercase", "TOOLONGPROJECT")) {
                assertThat(validator.validate(new OptimizationRequest(Arrays.asList(key), null, null, null)))
                        .as("project key %s", key).isNotEmpty();
            }
            assertThat(validator.validate(new ApplyOptimizationRequest(List.of("P"), null, null,
                    null, List.of("P-0"), null))).isNotEmpty();
        }
    }

    @Test
    void taskDatesMustUseTheSupportedCalendarRange() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            for (var date : List.of(LocalDate.MIN, LocalDate.MAX, LocalDate.of(0, 1, 1))) {
                assertThat(validator.validate(new TaskScheduleRequest(date, date))).isNotEmpty();
                assertThat(validator.validate(new TaskRequest("Task", null, null, null, null,
                        date, date, null, null, null, null))).isNotEmpty();
            }
            assertThat(validator.validate(new TaskScheduleRequest(LocalDate.of(1, 1, 1),
                    LocalDate.of(9999, 12, 31)))).isEmpty();
        }
    }
}
