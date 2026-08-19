package com.backend.services;

import com.backend.config.AppProperties;
import com.backend.dtos.NotificationDTO;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class SseEmitterManager {
    private static final Logger log = LoggerFactory.getLogger(SseEmitterManager.class);

    private final ConcurrentHashMap<Integer, List<SseEmitter>> emitters = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;
    private final long timeoutMs;
    private final int maxPerUser;

    public SseEmitterManager(ObjectMapper objectMapper, AppProperties appProperties) {
        this.objectMapper = objectMapper;
        this.timeoutMs = appProperties.getSse().getTimeoutMs();
        this.maxPerUser = appProperties.getSse().getMaxEmittersPerUser();
    }

    public SseEmitter createEmitter(Integer userId) {
        var emitter = new SseEmitter(timeoutMs);

        var userEmitters = emitters.computeIfAbsent(userId, key -> new CopyOnWriteArrayList<>());
        userEmitters.add(emitter);

        while (userEmitters.size() > maxPerUser) {
            var oldest = userEmitters.get(0);
            userEmitters.remove(oldest);
            log.debug("Retiring oldest SSE stream for user {} (cap {})", userId, maxPerUser);
            completeQuietly(oldest);
        }

        Runnable removeEmitter = () -> removeEmitter(userId, emitter);
        emitter.onCompletion(removeEmitter);
        emitter.onTimeout(removeEmitter);
        emitter.onError(e -> removeEmitter.run());

        try {
            emitter.send(SseEmitter.event().name("connected").data("ok"));
        } catch (Exception e) {
            completeWithErrorQuietly(emitter, e);
            removeEmitter.run();
        }

        return emitter;
    }

    public void sendNotification(Integer userId, NotificationDTO notification) {
        var userEmitters = emitters.get(userId);
        if (userEmitters == null || userEmitters.isEmpty()) {
            return;
        }

        String json;
        try {
            json = objectMapper.writeValueAsString(notification);
        } catch (Exception e) {
            log.error("Could not serialize notification {} for user {}", notification.id(), userId, e);
            return;
        }

        for (var emitter : userEmitters) {
            try {
                emitter.send(SseEmitter.event().name("notification").data(json));
            } catch (Exception e) {
                log.debug("Dropping dead SSE stream for user {}: {}", userId, e.getMessage());
                completeWithErrorQuietly(emitter, e);
                removeEmitter(userId, emitter);
            }
        }
    }

    private void removeEmitter(Integer userId, SseEmitter emitter) {
        emitters.computeIfPresent(userId, (key, list) -> {
            list.remove(emitter);
            return list.isEmpty() ? null : list;
        });
    }

    private static void completeQuietly(SseEmitter emitter) {
        try {
            emitter.complete();
        } catch (Exception e) {
        }
    }

    private static void completeWithErrorQuietly(SseEmitter emitter, Exception cause) {
        try {
            emitter.completeWithError(cause);
        } catch (Exception e) {
        }
    }
}
