package com.backend.services;

import com.backend.config.AppProperties;
import com.backend.dtos.NotificationDTO;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SseEmitterManager {
    private static final Logger log = LoggerFactory.getLogger(SseEmitterManager.class);

    private final ConcurrentHashMap<Integer, List<SseEmitter>> emitters = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;
    private final AppProperties appProperties;

    public SseEmitterManager(ObjectMapper objectMapper, AppProperties appProperties) {
        this.objectMapper = objectMapper;
        this.appProperties = appProperties;
    }

    public SseEmitter createEmitter(Integer userId) {
        var emitter = new SseEmitter(appProperties.getSse().getTimeoutMs());
        emitters.computeIfAbsent(userId, k -> new CopyOnWriteArrayList<>()).add(emitter);

        Runnable removeEmitter = () -> removeEmitter(userId, emitter);
        emitter.onCompletion(removeEmitter);
        emitter.onTimeout(removeEmitter);
        emitter.onError(e -> {
            emitter.completeWithError(e);
            removeEmitter.run();
        });

        // Send an initial event so proxies flush headers and the client confirms the stream is open.
        try {
            emitter.send(SseEmitter.event().name("connected").data("ok"));
        } catch (IOException e) {
            removeEmitter.run();
        }

        return emitter;
    }

    public void sendNotification(Integer userId, NotificationDTO notification) {
        var userEmitters = emitters.get(userId);
        if (userEmitters == null || userEmitters.isEmpty()) return;

        for (var emitter : userEmitters) {
            try {
                String json = objectMapper.writeValueAsString(notification);
                emitter.send(SseEmitter.event()
                        .name("notification")
                        .data(json));
            } catch (IOException e) {
                log.debug("Failed to send SSE to user {}, removing emitter", userId);
                removeEmitter(userId, emitter);
            }
        }
    }

    private void removeEmitter(Integer userId, SseEmitter emitter) {
        // Atomic: remove the emitter and drop the user's entry only if it is now empty, all under
        // the map bucket lock. This closes the check-then-remove race with a concurrent
        // createEmitter (which locks the same bucket via computeIfAbsent) that could otherwise
        // orphan a freshly-added emitter.
        emitters.computeIfPresent(userId, (key, list) -> {
            list.remove(emitter);
            return list.isEmpty() ? null : list;
        });
    }
}