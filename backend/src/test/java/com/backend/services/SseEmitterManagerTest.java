package com.backend.services;

import com.backend.config.AppProperties;
import com.backend.dtos.NotificationDTO;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

@DisplayName("SseEmitterManager")
class SseEmitterManagerTest {

    private SseEmitterManager manager;

    @BeforeEach
    void setUp() {
        var appProperties = new AppProperties();
        appProperties.getSse().setMaxEmittersPerUser(2);
        appProperties.getSse().setTimeoutMs(300_000);
        manager = new SseEmitterManager(new ObjectMapper(), appProperties);
    }

    @SuppressWarnings("unchecked")
    private Map<Integer, List<SseEmitter>> emitters() throws Exception {
        Field field = SseEmitterManager.class.getDeclaredField("emitters");
        field.setAccessible(true);
        return (Map<Integer, List<SseEmitter>>) field.get(manager);
    }

    @Test
    @DisplayName("retires the oldest emitter once a user goes over the per-user cap")
    void retiresTheOldestEmitterOverTheCap() throws Exception {
        var first = manager.createEmitter(1);
        var second = manager.createEmitter(1);
        var third = manager.createEmitter(1);

        var tracked = emitters().get(1);

        assertThat(tracked).hasSize(2);
        assertThat(tracked).doesNotContain(first);
        assertThat(tracked).containsExactly(second, third);
    }

    @Test
    @DisplayName("keeps each user's emitters independent of the others")
    void keepsEmittersIndependentPerUser() throws Exception {
        manager.createEmitter(1);
        manager.createEmitter(1);
        manager.createEmitter(2);

        assertThat(emitters().get(1)).hasSize(2);
        assertThat(emitters().get(2)).hasSize(1);
    }

    @Test
    @DisplayName("does nothing when sending to a user with no open streams")
    void doesNothingForAUserWithNoStreams() {
        assertThatCode(() -> manager.sendNotification(999, sampleNotification()))
                .doesNotThrowAnyException();
    }

    private static NotificationDTO sampleNotification() {
        return new NotificationDTO(1, "message", java.time.Instant.now(), false,
                com.backend.entities.NotificationType.TASK_UPDATED, null);
    }
}
