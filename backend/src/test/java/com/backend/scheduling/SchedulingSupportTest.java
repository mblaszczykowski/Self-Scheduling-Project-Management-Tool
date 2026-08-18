package com.backend.scheduling;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class SchedulingSupportTest {

    @Test
    @DisplayName("duration counts both endpoints")
    void durationIsInclusive() {
        assertThat(SchedulingSupport.inclusiveDurationDays(
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 3))).isEqualTo(3);
        assertThat(SchedulingSupport.inclusiveDurationDays(
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 1))).isEqualTo(1);
    }

    @Test
    @DisplayName("a missing or inverted range collapses to one day rather than going negative")
    void degenerateRangesAreClamped() {
        assertThat(SchedulingSupport.inclusiveDurationDays(null, LocalDate.of(2026, 1, 3))).isEqualTo(1);
        assertThat(SchedulingSupport.inclusiveDurationDays(
                LocalDate.of(2026, 1, 10), LocalDate.of(2026, 1, 1))).isEqualTo(1);
    }

    @ParameterizedTest
    @CsvSource({
            "10, 0, 10",
            "10, 50, 5",
            "10, 90, 1",
            "10, 100, 1",
            "10, 45, 6",
            "1, 99, 1"
    })
    @DisplayName("remaining work scales with progress and never drops below a day")
    void remainingWorkScalesWithProgress(int total, int progress, int expected) {
        assertThat(SchedulingSupport.remainingDurationDays(total, progress)).isEqualTo(expected);
    }

    @Test
    @DisplayName("a null progress is treated as untouched")
    void nullProgressMeansUntouched() {
        assertThat(SchedulingSupport.remainingDurationDays(7, null)).isEqualTo(7);
    }
}
