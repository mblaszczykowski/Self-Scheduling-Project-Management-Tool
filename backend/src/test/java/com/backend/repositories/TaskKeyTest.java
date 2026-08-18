package com.backend.repositories;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class TaskKeyTest {

    @Test
    @DisplayName("splits a key into project key and task number")
    void parsesWellFormedKey() {
        var parsed = TaskKey.parse("WEB-14");

        assertThat(parsed).isPresent();
        assertThat(parsed.get().projectKey()).isEqualTo("WEB");
        assertThat(parsed.get().taskNumber()).isEqualTo(14);
    }

    @Test
    @DisplayName("splits on the last dash, so a hyphenated project key survives")
    void splitsOnLastDash() {
        var parsed = TaskKey.parse("WEB-API-7");

        assertThat(parsed).isPresent();
        assertThat(parsed.get().projectKey()).isEqualTo("WEB-API");
        assertThat(parsed.get().taskNumber()).isEqualTo(7);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "-", "WEB", "WEB-", "-1", "WEB-abc", "WEB-0", "WEB--", "WEB-1.5", "WEB- 1"})
    @DisplayName("rejects anything that is not a task key")
    void rejectsMalformedKeys(String candidate) {
        assertThat(TaskKey.parse(candidate)).isEmpty();
    }

    @Test
    @DisplayName("rejects null")
    void rejectsNull() {
        assertThat(TaskKey.parse(null)).isEmpty();
    }
}
