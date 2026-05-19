package com.asap.server.global;

import java.util.concurrent.TimeUnit;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.task.TaskExecutor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.asap.server.domain.CodeBattleMatch;
import com.asap.server.domain.CodeBattleParticipant;
import com.asap.server.domain.CodeBattleSubmission;
import com.asap.server.domain.ContestSwissMatch;
import com.asap.server.dto.response.CodeBattleAiMatchResult;
import com.asap.server.dto.response.CodeBattleMatchResult;
import com.asap.server.repository.CodeBattleMatchRepository;
import com.asap.server.repository.CodeBattleParticipantRepository;
import com.asap.server.repository.CodeBattleSubmissionRepository;
import com.asap.server.repository.ContestSwissMatchRepository;
import com.asap.server.service.ContestRunService;
import com.asap.server.service.SseService;
import com.asap.server.service.SwissMatchMaker;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@RequiredArgsConstructor
@Slf4j
@Transactional
public class RedisResultWorker implements CommandLineRunner {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final SseService sseService;
    private final SwissMatchMaker swissMatchMaker;

    private final CodeBattleMatchRepository matchRepository;
    private final ContestSwissMatchRepository swissMatchRepository;
    private final CodeBattleSubmissionRepository submissionRepository;
    private final CodeBattleParticipantRepository participantRepository;
    private final ContestRunService contestRunService;

    private final TaskExecutor taskExecutor;

    @Override
    public void run(String... args) {
        taskExecutor.execute(this::pollNormalQueue);
        taskExecutor.execute(this::pollAiQueue);
        taskExecutor.execute(this::pollTestQueue);
        // taskExecutor.execute(this::pollPullLeagueQueue); // 최종 대회용으로 추가함
    }

    private void pollNormalQueue() {
        log.info("🚀 [대회용] Redis 결과 워커 가동...");
        while (!Thread.currentThread().isInterrupted()) {
            String rawData = null;
            try {
                rawData = redisTemplate.opsForList().rightPop("code_battle_result_queue", 5, TimeUnit.SECONDS);
                if (rawData == null)
                    continue;
                CodeBattleMatchResult result = objectMapper.readValue(rawData, CodeBattleMatchResult.class);
                CodeBattleMatch match = matchRepository.findById(result.getMatchId())
                        .orElseThrow(() -> new RuntimeException("Match not found (ID: " + result.getMatchId() + ")"));

                Long contestId = match.getContest().getId();
                log.info("🤖 [대회용] Redis 결과 처리...");
                String totalKey = redisTemplate.opsForValue().get("contest:total:" + contestId);
                if (totalKey != null) {// 최종 대회 처리
                    log.info("풀리그 결과 처리");
                    processNormalPullResult(rawData);
                } else {
                    String swissSessionIdStr = redisTemplate.opsForValue().get("swiss:matchId:" + result.getMatchId());
                    if (swissSessionIdStr != null) {
                        log.info("중간 스위스 결과 처리");
                        processNormalSwissResult(rawData, Long.parseLong(swissSessionIdStr));
                    } else
                        return;
                }
            } catch (Exception e) {
                if (Thread.currentThread().isInterrupted())
                    break;
                log.error("❌ 대회 결과 처리 중 에러: {}", e.getMessage());
                if (rawData != null)
                    redisTemplate.opsForList().leftPush("code_battle_result_error_queue", rawData);
            }
        }
    }

    private void processNormalPullResult(String rawData) throws JsonProcessingException {
        CodeBattleMatchResult result = objectMapper.readValue(rawData, CodeBattleMatchResult.class);
        CodeBattleMatch match = matchRepository.findById(result.getMatchId())
                .orElseThrow(() -> new RuntimeException("Match not found (ID: " + result.getMatchId() + ")"));

        int comp = result.getWinner();
        if (comp == 1) {
            match.setWinner(match.getUser1());
            match.setResult("WIN1");
        } else if (comp == 2) {
            match.setWinner(match.getUser2());
            match.setResult("WIN2");
        } else if (comp == 0) {
            match.setWinner(null);
            match.setResult("DRAW");
        }

        match.setLog(result.getLog());
        matchRepository.save(match);

        sseService.sendToUser(match.getUser1().getId(), result);
        sseService.sendToUser(match.getUser2().getId(), result);

        Long contestId = match.getContest().getId();

        // 제안 코드 — Redis 카운터로 완료 감지 ✅
        Long done = redisTemplate.opsForValue().increment("contest:done:" + contestId);
        String totalStr = redisTemplate.opsForValue().get("contest:total:" + contestId);
        if (totalStr == null) {
            log.warn("[풀리그] contest:total 키 없음. contestId={}", contestId);
            return;
        }
        Long total = Long.parseLong(totalStr);
        log.info("[풀리그] contestId={} {}/{}", contestId, done, total);

        if (done.equals(total)) {
            log.info("[풀리그] contestId={} 최종 집계 처리", contestId);
            swissMatchMaker.aggregateAndSave(contestId);
        }
    }

    // 스위서 결과 집계
    private void processNormalSwissResult(String rawData, Long sessionId) throws JsonProcessingException {
        CodeBattleMatchResult result = objectMapper.readValue(rawData, CodeBattleMatchResult.class);
        ContestSwissMatch match = swissMatchRepository.findById(result.getMatchId())
                .orElseThrow(() -> new RuntimeException("Match not found (ID: " + result.getMatchId() + ")"));

        // 매치 결과 저장
        int comp = result.getWinner();
        if (comp == 1) {
            match.setWinner(match.getUser1());
            match.setResult("WIN1");
        } else if (comp == 2) {
            match.setWinner(match.getUser2());
            match.setResult("WIN2");
        } else {
            match.setWinner(null);
            match.setResult("DRAW");
        }

        match.setLog(result.getLog());
        swissMatchRepository.save(match);

        sseService.sendToUser(match.getUser1().getId(), result);
        sseService.sendToUser(match.getUser2().getId(), result);

        // 참가자 점수 갱신 (다음 세션 매칭에 반영하기 위함)
        Long contestId = match.getRound().getSession().getContest().getId();
        CodeBattleParticipant p1 = participantRepository.findByContestIdAndUserId(contestId, match.getUser1().getId());
        CodeBattleParticipant p2 = participantRepository.findByContestIdAndUserId(contestId, match.getUser2().getId());

        if (comp == 1) {
            p1.setScore(p1.getScore() + 1);
            p2.setScore(p2.getScore() - 1);
        } else if (comp == 2) {
            p2.setScore(p2.getScore() + 1);
            p1.setScore(p1.getScore() - 1);
        }

        participantRepository.save(p1);
        participantRepository.save(p2);

        // 세션 완료 카운트 + 집계 트리거
        Long done = redisTemplate.opsForValue().increment("swiss:done:" + sessionId);
        String totalStr = redisTemplate.opsForValue().get("swiss:total:" + sessionId);
        if (totalStr == null) {
            log.warn("[Swiss] swiss:total 키 없음. sessionId={}", sessionId);
            return;
        }
        Long total = Long.parseLong(totalStr);
        log.info("[Swiss] sessionId={} {}/{}", sessionId, done, total);

        if (done.equals(total)) {
            log.info("[Swiss] sessionId={} 세션 집계 시작", sessionId);
            contestRunService.aggregateSwissSession(sessionId);
        }
    }

    private void pollAiQueue() {
        log.info("🤖 [AI 전용] Redis 결과 워커 가동...");
        while (!Thread.currentThread().isInterrupted()) {
            String rawData = null;
            try {
                rawData = redisTemplate.opsForList().rightPop("code_battle_ai_result_queue", 5, TimeUnit.SECONDS);
                if (rawData == null)
                    continue;
                log.info("🤖 [AI 전용] Redis 결과 처리...");
                processAiResult(rawData);
            } catch (Exception e) {
                if (Thread.currentThread().isInterrupted())
                    break;
                log.error("❌ AI 결과 처리 중 에러: {}", e.getMessage());
                if (rawData != null)
                    redisTemplate.opsForList().leftPush("code_battle_ai_result_error_queue", rawData);
            }
        }
    }

    private void processAiResult(String rawData) throws JsonProcessingException {
        log.info("❌ AI 결과 처리 Log \n {}", rawData);
        CodeBattleMatchResult result = objectMapper.readValue(rawData, CodeBattleMatchResult.class);
        Long submissionId = result.getMatchId();

        CodeBattleSubmission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new RuntimeException("Submission not found (ID: " + submissionId + ")"));

        CodeBattleMatch aiMatch = matchRepository.findBySubmissionIdAndAiOrder(submissionId, result.getAiOrder())
                .orElse(null);

        if (aiMatch != null) {
            int comp = result.getWinner();
            if (comp == 1)
                aiMatch.setWinner(aiMatch.getUser1());
            else if (comp == 2)
                aiMatch.setWinner(aiMatch.getUser2());
            else
                aiMatch.setWinner(null);

            aiMatch.setLog(result.getLog());
            matchRepository.save(aiMatch);

            Long targetUserId = aiMatch.getUser1().getId();

            CodeBattleAiMatchResult sseResponse = CodeBattleAiMatchResult.from(aiMatch, targetUserId);

            sseService.sendToUser(targetUserId, sseResponse);
        }
    }

    private void pollTestQueue() {
        log.info("🤖 [검수자 전용] Redis 결과 워커 가동...");
        while (!Thread.currentThread().isInterrupted()) {
            String rawData = null;
            try {
                rawData = redisTemplate.opsForList().rightPop("code_battle_test_result_queue", 5, TimeUnit.SECONDS);
                if (rawData == null)
                    continue;
                log.info("🤖 [검수자 전용] Redis 결과 처리...");
                processTestResult(rawData);
            } catch (Exception e) {
                if (Thread.currentThread().isInterrupted())
                    break;
                log.error("❌ 검수자 결과 처리 중 에러: {}", e.getMessage());
                if (rawData != null)
                    redisTemplate.opsForList().leftPush("code_battle_test_result_error_queue", rawData);
            }
        }
    }

    private void processTestResult(String rawData) throws JsonProcessingException {
        try {
            log.info("❌ 검수 결과 처리 Log \n {}", rawData);

            JsonNode rootNode = objectMapper.readTree(rawData);

            // 채점 서버가 보내주는 데이터 타입에 맞게 파싱 방법을 선택하세요 (String vs Long)
            String userIdStr = rootNode.get("userId").asText();
            Long targetUserId = Long.parseLong(userIdStr);

            String resultLog = rootNode.get("log").asText();

            sseService.sendToUser(targetUserId, resultLog, "test_result");

            log.info("🎯 유저(ID: {})에게 SSE 로그 전송 완료 완료", targetUserId);

        } catch (JsonProcessingException e) {
            log.error("Redis 메시지 JSON 파싱 실패: {}", rawData, e);
        } catch (NumberFormatException e) {
            log.error("userid 형변환 실패 (Long 타입이 아님)", e);
        } catch (Exception e) {
            log.error("결과 처리 중 알 수 없는 오류 발생", e);
        }
    }

    private void handleFailure(String rawData, Exception e) {
        log.warn("🔄 에러 발생으로 데이터를 재처리 큐로 보냅니다.");
        redisTemplate.opsForList().leftPush("code_battle_result_error_queue", rawData);
    }
}