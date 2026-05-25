package com.asap.server.service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class SseService {
    private final Map<Long, SseEmitter> emitters = new ConcurrentHashMap<>();
    private final Map<String, List<SseEmitter>> sessionEmitters = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> sessionStates = new ConcurrentHashMap<>();

    public SseEmitter subscribe(Long userId) {
        SseEmitter emitter = new SseEmitter(30 * 60 * 1000L);
        emitters.put(userId, emitter);

        emitter.onCompletion(() -> emitters.remove(userId));
        emitter.onTimeout(() -> emitters.remove(userId));

        return emitter;
    }

    public void sendToUser(Long userId, Object data) {
        sendToUser(userId, data, "match_result");
    }

    public void sendToUser(Long userId, Object data, String eventName) {
        SseEmitter emitter = emitters.get(userId);
        log.info("[SSE] : {}", emitters.toString());
        if (emitter != null) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(data));
                log.info("[SSE] : success");
            } catch (IOException e) {
                emitters.remove(userId);
            }
        }
    }

    public SseEmitter subscribeSession(Long contestId, Long sessionId) {
        String key = contestId + ":" + sessionId;
        SseEmitter emitter = new SseEmitter(30 * 60 * 1000L);
        sessionEmitters.computeIfAbsent(key, k -> new ArrayList<>()).add(emitter);

        emitter.onCompletion(() -> removeSessionEmitter(key, emitter));
        emitter.onTimeout(() -> removeSessionEmitter(key, emitter));

        // 이미 진행 중인 세션이면 현재 상태를 즉시 전송 (init)
        Map<String, Object> currentState = sessionStates.get(key);
        if (currentState != null) {
            try {
                emitter.send(SseEmitter.event().name("session-state").data(currentState));
            } catch (IOException e) {
                removeSessionEmitter(key, emitter);
            }
        }

        return emitter;
    }

    private void removeSessionEmitter(String key, SseEmitter emitter) {
        List<SseEmitter> list = sessionEmitters.get(key);
        if (list != null) {
            list.remove(emitter);
            if (list.isEmpty())
                sessionEmitters.remove(key);
        }
    }

    public void sendToSession(Long contestId, Long sessionId, Object data, String eventName) {
        String key = contestId + ":" + sessionId;
        List<SseEmitter> list = sessionEmitters.get(key);
        if (list == null)
            return;
        List<SseEmitter> dead = new ArrayList<>();
        list.forEach(emitter -> {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(data));
            } catch (IOException e) {
                dead.add(emitter);
            }
        });
        list.removeAll(dead);
    }

    public void updateSessionState(Long contestId, Long sessionId, Map<String, Object> state) {
        sessionStates.put(contestId + ":" + sessionId, state);
        sendToSession(contestId, sessionId, state, "session-state");
    }

    public Map<String, Object> getSessionState(Long contestId, Long sessionId) {
        return sessionStates.get(contestId + ":" + sessionId);
    }

    public void clearSessionState(Long contestId, Long sessionId) {
        sessionStates.remove(contestId + ":" + sessionId);
    }
}
