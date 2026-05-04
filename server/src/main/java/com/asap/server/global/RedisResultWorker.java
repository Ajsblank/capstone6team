package com.asap.server.global;

import com.asap.server.dto.response.CodeBattleMatchResult;
import org.springframework.transaction.annotation.Transactional;
import com.asap.server.repository.CodeBattleMatchRepository;
import com.asap.server.domain.CodeBattleMatch;
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
    private final CodeBattleMatchRepository matchRepository;
    private final SwissMatchMaker swissMatchMaker;
    private final CodeBattleParticipantRepository participantRepository;

    private final TaskExecutor taskExecutor;

    @Override
    public void run(String... args) {
        taskExecutor.execute(this::pollRedisQueue);
    }

    private void pollRedisQueue() {
        log.info("🚀 Redis 결과 워커가 가동되었습니다.");
        
        while (!Thread.currentThread().isInterrupted()) {
            String rawData = null;
            try {
                // Redis에서 데이터 Pop
                rawData = redisTemplate.opsForList().rightPop("code_battle_result_queue", 60, TimeUnit.SECONDS);
                if (rawData == null) continue;

                // 비즈니스 로직 처리
                processResult(rawData);

            } catch (Exception e) {

                if (Thread.currentThread().isInterrupted()) {
                    log.info("🛑 워커 쓰레드가 중단되었습니다. 종료 절차를 밟습니다.");
                    break;
                }

                log.error("❌ 결과 처리 중 에러 발생: {}", e.getMessage());
                
                // 데이터 유실 방지
                if (rawData != null) {
                    handleFailure(rawData, e);
                }
            }
        }
    }

    private void processResult(String rawData) throws JsonProcessingException {
        try {
            // JSON 파싱 및 매치 조회
            CodeBattleMatchResult result = objectMapper.readValue(rawData, CodeBattleMatchResult.class);
            
            CodeBattleMatch match = matchRepository.findById(result.getMatchId())
                    .orElseThrow(() -> new RuntimeException("Match not found (ID: " + result.getMatchId() + ")"));

            // AI 배틀 여부 확인
            boolean isAIBattle = (match.getUser2().getId() == 1L);

            // 승패 판별 및 로그 기록
            int comp = Integer.parseInt(result.getWinner());
            if (comp == 1) match.setWinner(match.getUser1());
            else if (comp == 2) match.setWinner(match.getUser2());
            else match.setWinner(null);

            match.setLog(result.getLog());
            matchRepository.save(match);

            // 공통 처리: SSE 알림 전송
            sseService.sendToUser(match.getUser1().getId(), result);
            if (!isAIBattle) {
                sseService.sendToUser(match.getUser2().getId(), result);
            }

            if (isAIBattle) {
                return;
            }

            Long contestId = match.getContest().getId();

            // 참가자 점수 업데이트
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

            // 라운드 종료 여부 체크 및 다음 라운드 트리거
            List<CodeBattleParticipant> allParticipants = participantRepository.findByContestId(contestId);
            int matchesPerRound = allParticipants.size() / 2;

            long totalCreatedMatches = matchRepository.countByContestId(contestId);
            long totalFinishedMatches = matchRepository.countFinishedMatchesByContestId(contestId);

            // 현재 라운드의 모든 경기가 끝났는지 확인
            if (totalCreatedMatches > 0 && totalCreatedMatches == totalFinishedMatches) {
                int currentCompletedRound = (int) (totalFinishedMatches / matchesPerRound);
                log.info("[Worker] 대회 ID: {}, {}라운드 모든 경기 종료!", contestId, currentCompletedRound);

                int MAX_ROUND = 10;
                if (currentCompletedRound < MAX_ROUND) {
                    log.info("[Worker] 다음 라운드를 준비합니다...");
                    swissMatchMaker.generateNextRound(contestId);
                } else {
                    log.info("[Worker] 대회 ID: {} 의 10라운드가 모두 종료되었습니다. 대회 완료!", contestId);
                    // TODO: 대회 상태를 FINISHED로 변경
                    // match.getContest().updateStatus(ContestStatus.FINISHED);
                }
            }

        } catch (Exception e) {
            log.error("[Worker] 채점 결과 처리 중 오류 발생: {}", e.getMessage(), e);
        }
    }

    private void handleFailure(String rawData, Exception e) {
        log.warn("🔄 에러 발생으로 데이터를 재처리 큐로 보냅니다.");
        redisTemplate.opsForList().leftPush("code_battle_result_error_queue", rawData);
    }
}