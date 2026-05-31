package com.asap.server.global;

import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.task.TaskExecutor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import com.asap.server.domain.CodeBattleMatch;
import com.asap.server.dto.response.CodeBattleAiMatchResult;
import com.asap.server.dto.response.CodeBattleMatchResult;
import com.asap.server.repository.CodeBattleMatchRepository;
import com.asap.server.service.FullLeagueService;
import com.asap.server.service.SseService;
import com.asap.server.service.SwissLeagueService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
public class RedisResultWorker implements CommandLineRunner, DisposableBean {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final SseService sseService;
    private final FullLeagueService fullLeagueService;

    private final CodeBattleMatchRepository matchRepository;
    private final SwissLeagueService swissService;
    private final TaskExecutor taskExecutor;
    private static final String CODE_BATTLE_SWISS_LEAGUE_QUEUE_RESULT_KEY = "code_battle_swiss_league_result_queue";
    private static final String CODE_BATTLE_FULL_LEAGUE_QUEUE__RESULT_KEY = "code_battle_full_league_result_queue";

    public RedisResultWorker(
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            SseService sseService,
            FullLeagueService fullLeagueService,
            CodeBattleMatchRepository matchRepository,
            SwissLeagueService swissService,
            @Qualifier("workerTaskExecutor") TaskExecutor taskExecutor) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.sseService = sseService;
        this.fullLeagueService = fullLeagueService;
        this.matchRepository = matchRepository;
        this.swissService = swissService;
        this.taskExecutor = taskExecutor;
    }

    private volatile boolean running = true;

    @Override
    public void destroy() {
        log.info("[RedisResultWorker] 종료 시그널 수신");
        running = false; // 종료 시그널
    }

    @Override
    public void run(String... args) {
        taskExecutor.execute(this::pollFullQueue);
        taskExecutor.execute(this::pollAiQueue);
        taskExecutor.execute(this::pollTestQueue);
        taskExecutor.execute(this::pollSwissResult);
    }

    private void pollFullQueue() {
        log.info("🚀 [풀리그 대회용] Redis 결과 워커 가동...");
        while (running && !Thread.currentThread().isInterrupted()) {
            String rawData = null;
            try {
                rawData = redisTemplate.opsForList().rightPop(CODE_BATTLE_FULL_LEAGUE_QUEUE__RESULT_KEY, 5,
                        TimeUnit.SECONDS);
                if (rawData == null)
                    continue;

                log.info("🤖 [대회용] Redis 결과 처리...");
                fullLeagueService.processNormalFullResult(rawData);
            } catch (Exception e) {
                if (!running || Thread.currentThread().isInterrupted())
                    break;
                log.error("❌ 대회 결과 처리 중 에러: {}", e.getMessage());
                if (rawData != null)
                    redisTemplate.opsForList().leftPush("code_battle_result_error_queue", rawData);
            }
        }
        log.info("🚀 [풀리그 대회용] Redis 결과 워커 종료");
    }

    // 스위서 결과 집계
    private void pollSwissResult() {
        log.info("🚀 [스위스 대회용] Redis 결과 워커 가동...");
        while (running && !Thread.currentThread().isInterrupted()) {
            String rawData = null;
            try {
                rawData = redisTemplate.opsForList().rightPop(CODE_BATTLE_SWISS_LEAGUE_QUEUE_RESULT_KEY, 5,
                        TimeUnit.SECONDS);
                if (rawData == null)
                    continue;
                log.info("[스위스리그] Redis 결과 처리...");
                swissService.processSwissResult(rawData);
            } catch (Exception e) {
                if (!running || Thread.currentThread().isInterrupted())
                    break;
                log.error("❌ 대회 결과 처리 중 에러: {}", e.getMessage());
                if (rawData != null)
                    redisTemplate.opsForList().leftPush("code_battle_result_error_queue", rawData);
            }
        }
    }

    private void pollAiQueue() {
        log.info("🤖 [AI 전용] Redis 결과 워커 가동...");
        while (running && !Thread.currentThread().isInterrupted()) {
            String rawData = null;
            try {
                rawData = redisTemplate.opsForList().rightPop("code_battle_ai_result_queue", 5, TimeUnit.SECONDS);
                if (rawData == null)
                    continue;
                log.info("🤖 [AI 전용] Redis 결과 처리...");
                processAiResult(rawData);
            } catch (Exception e) {
                if (!running || Thread.currentThread().isInterrupted())
                    break;
                log.error("❌ AI 결과 처리 중 에러: {}", e.getMessage());
                if (rawData != null)
                    redisTemplate.opsForList().leftPush("code_battle_ai_result_error_queue", rawData);
            }
        }
    }

    private void processAiResult(String rawData) throws JsonProcessingException {
        log.info("🤖 AI 결과 처리 Log \n {}", rawData);
        CodeBattleMatchResult result = objectMapper.readValue(rawData, CodeBattleMatchResult.class);
        Long submissionId = result.getMatchId();

        CodeBattleMatch aiMatch = matchRepository.findBySubmissionIdAndAiOrder(submissionId, result.getAiOrder())
                .orElse(null);
        // submission 조회 삭제
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
        while (running && !Thread.currentThread().isInterrupted()) {
            String rawData = null;
            try {
                rawData = redisTemplate.opsForList().rightPop("code_battle_test_result_queue", 5, TimeUnit.SECONDS);
                if (rawData == null)
                    continue;
                log.info("🤖 [검수자 전용] Redis 결과 처리...");
                processTestResult(rawData);
            } catch (Exception e) {
                if (!running || Thread.currentThread().isInterrupted())
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