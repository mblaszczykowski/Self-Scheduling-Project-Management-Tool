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

/**
 * Holds the open Server-Sent Events streams, keyed by user.
 *
 * <p>Capped per user: the server only notices a vanished client on the next write or at the
 * configured timeout, so a client stuck in a reconnect loop would otherwise accumulate live
 * emitters — each holding a servlet async context — and multiply every notification fan-out.
 */
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

        // Over the cap, retire the oldest rather than refusing the newest: the newest is the one
        // the user is actually looking at.
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

        // An initial event makes proxies flush headers and lets the client confirm the stream.
        try {
            emitter.send(SseEmitter.event().name("connected").data("ok"));
        } catch (Exception e) {
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
            // Serialize once, not once per stream.
            json = objectMapper.writeValueAsString(notification);
        } catch (Exception e) {
            log.error("Could not serialize notification {} for user {}", notification.id(), userId, e);
            return;
        }

        for (var emitter : userEmitters) {
            try {
                emitter.send(SseEmitter.event().name("notification").data(json));
            } catch (Exception e) {
                // Catch Exception, not IOException: sending to an emitter that has already
                // completed throws IllegalStateException, and letting that escape would abort the
                // loop so the remaining streams never received the event.
                log.debug("Dropping dead SSE stream for user {}: {}", userId, e.getMessage());
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

    private static void completeQuietly(SseEmitter emitter) {
        try {
            emitter.complete();
        } catch (Exception e) {
            // Already closed by the container; nothing to do.
        }
    }
}
