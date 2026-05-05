package com.asap.server.global;

import com.asap.server.dto.response.CodeBattleMatchResult;
import org.springframework.transaction.annotation.Transactional;
import com.asap.server.repository.CodeBattleMatchRepository;
import com.asap.server.repository.CodeBattleSubmissionRepository;
import com.asap.server.domain.CodeBattleMatch;
import com.asap.server.domain.CodeBattleSubmission;
import com.asap.server.service.SseService;
import com.asap.server.service.SwissMatchMaker;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.task.TaskExecutor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import java.util.concurrent.TimeUnit;
import com.asap.server.domain.CodeBattleParticipant;
import java.util.List;
import com.asap.server.repository.CodeBattleParticipantRepository;

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
    private final CodeBattleSubmissionRepository submissionRepository;
    private final CodeBattleParticipantRepository participantRepository;

    private final TaskExecutor taskExecutor;

    @Override
    public void run(String... args) {
        taskExecutor.execute(this::pollNormalQueue);
        taskExecutor.execute(this::pollAiQueue);
    }

    private void pollNormalQueue() {
        log.info("🚀 [대회용] Redis 결과 워커 가동...");
        while (!Thread.currentThread().isInterrupted()) {
            String rawData = null;
            try {
                rawData = redisTemplate.opsForList().rightPop("code_battle_result_queue", 5, TimeUnit.SECONDS);
                if (rawData == null) continue;
                log.info("🤖 [대회용] Redis 결과 처리...");
                processNormalResult(rawData);
            } catch (Exception e) {
                if (Thread.currentThread().isInterrupted()) break;
                log.error("❌ 대회 결과 처리 중 에러: {}", e.getMessage());
                if (rawData != null) redisTemplate.opsForList().leftPush("code_battle_result_error_queue", rawData);
            }
        }
    }

    private void processNormalResult(String rawData) throws JsonProcessingException {
        CodeBattleMatchResult result = objectMapper.readValue(rawData, CodeBattleMatchResult.class);
        CodeBattleMatch match = matchRepository.findById(result.getMatchId())
                .orElseThrow(() -> new RuntimeException("Match not found (ID: " + result.getMatchId() + ")"));

        int comp = Integer.parseInt(result.getWinner());
        if (comp == 1) match.setWinner(match.getUser1());
        else if (comp == 2) match.setWinner(match.getUser2());
        else match.setWinner(null);

        match.setLog(result.getLog());
        matchRepository.save(match);

        sseService.sendToUser(match.getUser1().getId(), result);
        sseService.sendToUser(match.getUser2().getId(), result);

        Long contestId = match.getContest().getId();
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

        // 라운드 종료 체크
        List<CodeBattleParticipant> allParticipants = participantRepository.findByContestId(contestId);
        int matchesPerRound = allParticipants.size() / 2;
        long totalCreated = matchRepository.countByContestId(contestId);
        long totalFinished = matchRepository.countFinishedMatchesByContestId(contestId);

        if (totalCreated > 0 && totalCreated == totalFinished) {
            int currentRound = (int) (totalFinished / matchesPerRound);
            if (currentRound < 10) swissMatchMaker.generateNextRound(contestId);
            else log.info("[Worker] 대회 ID: {} 10라운드 완료!", contestId);
        }
    }
    
    private void pollAiQueue() {
        log.info("🤖 [AI 전용] Redis 결과 워커 가동...");
        while (!Thread.currentThread().isInterrupted()) {
            String rawData = null;
            try {
                rawData = redisTemplate.opsForList().rightPop("code_battle_ai_result_queue", 5, TimeUnit.SECONDS);
                if (rawData == null) continue;
                log.info("🤖 [AI 전용] Redis 결과 처리...");
                processAiResult(rawData);
            } catch (Exception e) {
                if (Thread.currentThread().isInterrupted()) break;
                log.error("❌ AI 결과 처리 중 에러: {}", e.getMessage());
                if (rawData != null) redisTemplate.opsForList().leftPush("code_battle_ai_result_error_queue", rawData);
            }
        }
    }

    private void processAiResult(String rawData) throws JsonProcessingException {
        CodeBattleMatchResult result = objectMapper.readValue(rawData, CodeBattleMatchResult.class);
        Long submissionId = result.getMatchId();

        CodeBattleSubmission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new RuntimeException("Submission not found (ID: " + submissionId + ")"));

        CodeBattleMatch aiMatch = matchRepository.findBySubmissionIdAndAiOrder(submissionId, result.getAiOrder())
        .orElse(null);

        if (aiMatch != null) {
            int comp = Integer.parseInt(result.getWinner());
            if (comp == 1) aiMatch.setWinner(aiMatch.getUser1());
            else if (comp == 2) aiMatch.setWinner(aiMatch.getUser2());
            else aiMatch.setWinner(null);

            aiMatch.setLog(result.getLog());
            matchRepository.save(aiMatch);

            sseService.sendToUser(aiMatch.getUser1().getId(), result);
        }
    }

    private void handleFailure(String rawData, Exception e) {
        log.warn("🔄 에러 발생으로 데이터를 재처리 큐로 보냅니다.");
        redisTemplate.opsForList().leftPush("code_battle_result_error_queue", rawData);
    }
}