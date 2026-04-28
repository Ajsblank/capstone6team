package com.asap.server.global;

import com.asap.server.dto.response.CodeBattleMatchResult;
import com.asap.server.repository.CodeBattleMatchRepository;
import com.asap.server.domain.CodeBattleMatch;
import com.asap.server.service.SseService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.task.TaskExecutor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import java.util.concurrent.TimeUnit;

@Component
@RequiredArgsConstructor
@Slf4j
public class RedisResultWorker implements CommandLineRunner {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final SseService sseService;
    private final CodeBattleMatchRepository matchRepository;

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
    }

    private void handleFailure(String rawData, Exception e) {
        log.warn("🔄 에러 발생으로 데이터를 재처리 큐로 보냅니다.");
        redisTemplate.opsForList().leftPush("code_battle_result_error_queue", rawData);
    }
}