package com.asap.server.service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class SseService {
    private final Map<Long, SseEmitter> emitters = new ConcurrentHashMap<>();

    // 세션 구독자 목록 - List를 CopyOnWriteArrayList로 교체
    private final Map<String, CopyOnWriteArrayList<SseEmitter>> sessionEmitters = new ConcurrentHashMap<>();

    // 세션 최신 상태 캐시 - Object로 받아서 DTO 그대로 저장 가능
    private final Map<String, Object> sessionStates = new ConcurrentHashMap<>();
    // 현재는 sse 풀 하나만 생성
    private final ScheduledExecutorService heartbeatScheduler = Executors.newScheduledThreadPool(1);

    public SseEmitter subscribe(Long userId) {
        SseEmitter emitter = new SseEmitter(30 * 60 * 1000L);
        emitters.put(userId, emitter);

        // 연결 확립용 초기 전송 — 이게 있어야 헤더가 flush되어 브라우저 onopen 발생
        try {
            emitter.send(SseEmitter.event().name("connect").data("ok"));
        } catch (IOException e) {
            emitters.remove(userId, emitter);
            emitter.completeWithError(e);
            return emitter;
        }
        // 55초마다 heartbeat (CloudFront 연결 끊김 방지)
        ScheduledFuture<?> heartbeatTask = heartbeatScheduler.scheduleAtFixedRate(() -> {
            try {
                emitter.send(SseEmitter.event().comment("heartbeat"));
            } catch (IOException e) {
                emitters.remove(userId, emitter);
                emitter.complete();
            }
        }, 55, 55, TimeUnit.SECONDS);

        // remove(key, value): 이 emitter가 현재 map에 있을 때만 삭제 (재연결 시 새 emitter 보호)
        emitter.onCompletion(() -> {
            emitters.remove(userId, emitter);
            heartbeatTask.cancel(true);
        });
        emitter.onTimeout(() -> {
            emitters.remove(userId, emitter);
            heartbeatTask.cancel(true);
        });
        emitter.onError(e -> {
            emitters.remove(userId, emitter);
            heartbeatTask.cancel(true);
        });

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

    // session 구독
    public SseEmitter subscribeSession(Long contestId, Long sessionId) {
        String key = buildKey(contestId, sessionId);
        log.info("[SSE 구독 시작] key={}", key);

        SseEmitter emitter = new SseEmitter(30 * 60 * 1000L);

        emitter.onCompletion(() -> removeSessionEmitter(key, emitter));
        emitter.onTimeout(() -> removeSessionEmitter(key, emitter));
        emitter.onError(e -> removeSessionEmitter(key, emitter));

        // init 먼저 전송 후 emitter 등록 → update가 init보다 먼저 도착하는 문제 방지
        Object currentState = sessionStates.get(key);
        if (currentState != null) {
            try {
                emitter.send(SseEmitter.event().name("init").data(currentState));
                log.info("[SSE init 전송] key={}", key);
            } catch (IOException e) {
                log.error("[SSE init 전송 실패] key={}", key);
                emitter.completeWithError(e);
                return emitter; // 등록 없이 반환
            }
        } else {
            // 상태 없음 = 세션 시작 전
            try {
                emitter.send(SseEmitter.event()
                        .name("init")
                        .data(Map.of("status", "WAITING")));
            } catch (IOException e) {
                emitter.completeWithError(e);
                return emitter;
            }
        }
        // init 성공 후 등록
        sessionEmitters
                .computeIfAbsent(key, k -> new CopyOnWriteArrayList<>())
                .add(emitter);
        log.info("[SSE 구독 등록 완료] key={} 구독자 수={}", key,
                sessionEmitters.get(key).size());
        return emitter;
    }

    // ──────────────────────────────────────────
    // 세션 상태 업데이트 및 브로드캐스트
    // ──────────────────────────────────────────

    /**
     * 상태를 캐싱하고 구독자 전체에게 update 이벤트 전송
     * data는 DTO 그대로 넘기면 됨
     */
    public void updateSessionState(Long contestId, Long sessionId, Object state) {
        String key = buildKey(contestId, sessionId);
        sessionStates.put(key, state);
        broadcast(key, state, "update");
        log.info("[SSE 상태 업데이트] key={}", key);
    }

    // session 정리 함수
    public void clearSession(Long contestId, Long sessionId) {
        String key = buildKey(contestId, sessionId);
        sessionStates.remove(key);
        sessionEmitters.remove(key);
        log.info("[SSE 세션 정리] key={}", key);
    }

    public Object getSessionState(Long contestId, Long sessionId) {
        return sessionStates.get(buildKey(contestId, sessionId));
    }

    // ──────────────────────────────────────────
    // 내부 유틸
    // ──────────────────────────────────────────

    private void broadcast(String key, Object data, String eventName) {
        CopyOnWriteArrayList<SseEmitter> list = sessionEmitters.get(key);
        if (list == null || list.isEmpty())
            return;

        List<SseEmitter> dead = new ArrayList<>();
        for (SseEmitter emitter : list) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(data));
            } catch (IOException e) {
                log.warn("[SSE 브로드캐스트 실패] key={} emitter 제거", key);
                dead.add(emitter);
            }
        }
        list.removeAll(dead);
    }

    private void removeSessionEmitter(String key, SseEmitter emitter) {
        CopyOnWriteArrayList<SseEmitter> list = sessionEmitters.get(key);
        if (list == null)
            return;
        list.remove(emitter);
        if (list.isEmpty())
            sessionEmitters.remove(key);
        log.info("[SSE 연결 해제] key={} 남은 구독자={}", key,
                sessionEmitters.getOrDefault(key, new CopyOnWriteArrayList<>()).size());
    }

    private String buildKey(Long contestId, Long sessionId) {
        return contestId + ":" + sessionId;
    }

    // 라운드 추가
    public void addRound(Long contestId, Long sessionId, Map<String, Object> roundState) {
        Map<String, Object> state = getSessionStateAsMap(contestId, sessionId);
        if (state == null)
            return;
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rounds = (List<Map<String, Object>>) state.get("rounds");
        if (rounds != null)
            rounds.add(roundState);
        updateSessionState(contestId, sessionId, state);
    }

    // 라운드 상태 변경
    public void updateRoundStatus(Long contestId, Long sessionId, int roundNumber, String status) {
        Map<String, Object> state = getSessionStateAsMap(contestId, sessionId);
        if (state == null)
            return;
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rounds = (List<Map<String, Object>>) state.get("rounds");
        if (rounds == null)
            return;
        rounds.stream()
                .filter(r -> ((Number) r.get("round_number")).intValue() == roundNumber)
                .findFirst()
                .ifPresent(r -> r.put("status", status));
        updateSessionState(contestId, sessionId, state);
    }

    // 매치 추가
    public void addMatch(Long contestId, Long sessionId, int roundNumber, Map<String, Object> matchInfo) {
        Map<String, Object> state = getSessionStateAsMap(contestId, sessionId);
        if (state == null)
            return;
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rounds = (List<Map<String, Object>>) state.get("rounds");
        if (rounds == null)
            return;
        rounds.stream()
                .filter(r -> ((Number) r.get("round_number")).intValue() == roundNumber)
                .findFirst()
                .ifPresent(r -> {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> matches = (List<Map<String, Object>>) r.get("matches");
                    if (matches != null)
                        matches.add(matchInfo);
                });
        updateSessionState(contestId, sessionId, state);
    }

    // 매치 결과 업데이트
    public void updateMatchResult(Long contestId, Long sessionId, int roundNumber, Long matchId, int winner,
            Object result) {
        Map<String, Object> state = getSessionStateAsMap(contestId, sessionId);
        if (state == null)
            return;
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rounds = (List<Map<String, Object>>) state.get("rounds");
        if (rounds == null)
            return;
        rounds.stream()
                .filter(r -> ((Number) r.get("round_number")).intValue() == roundNumber)
                .findFirst()
                .ifPresent(r -> {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> matches = (List<Map<String, Object>>) r.get("matches");
                    if (matches == null)
                        return;
                    matches.stream()
                            .filter(m -> m.get("match_id") != null
                                    && ((Number) m.get("match_id")).longValue() == matchId)
                            .findFirst()
                            .ifPresent(m -> {
                                m.put("winner", winner);
                                m.put("result", result);
                            });
                });
        updateSessionState(contestId, sessionId, state);
    }

    // 세션 status 변경
    public void updateSessionStatus(Long contestId, Long sessionId, String status) {
        Map<String, Object> state = getSessionStateAsMap(contestId, sessionId);
        if (state == null)
            return;
        state.put("status", status);
        updateSessionState(contestId, sessionId, state);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getSessionStateAsMap(Long contestId, Long sessionId) {
        Object state = sessionStates.get(buildKey(contestId, sessionId));
        if (state instanceof Map)
            return (Map<String, Object>) state;
        return null;
    }
}
