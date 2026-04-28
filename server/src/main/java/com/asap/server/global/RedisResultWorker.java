package com.asap.server.global;

import com.asap.server.dto.response.CodeBattleMatchResult;
import com.asap.server.repository.CodeBattleMatchRepository;
import com.asap.server.domain.CodeBattleMatch;
import com.asap.server.service.SseService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import java.util.concurrent.TimeUnit;

@Component
@RequiredArgsConstructor
public class RedisResultWorker implements CommandLineRunner {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final SseService sseService;
    private final CodeBattleMatchRepository matchRepository;

    @Override
    public void run(String... args) {
        Thread workerThread = new Thread(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                try {
                    String rawData = redisTemplate.opsForList()
                            .rightPop("code_battle_result_queue", 60, TimeUnit.SECONDS);

                    if (rawData != null) {
                        CodeBattleMatchResult result = objectMapper.readValue(rawData, CodeBattleMatchResult.class);
                        
                        // DB에서 매치 조회
                        CodeBattleMatch match = matchRepository.findById(result.getMatchId())
                                .orElseThrow(() -> new RuntimeException("Match not found"));

                        // 승자 매핑 (1=user1, 2=user2, 0=null)
                        int comp = Integer.parseInt(result.getWinner());
                        if (comp == 1) {
                            match.setWinner(match.getUser1());
                        } else if (comp == 2) {
                            match.setWinner(match.getUser2());
                        } else {
                            match.setWinner(null);
                        }

                        // 로그 업데이트 및 저장
                        match.setLog(result.getLog());
                        matchRepository.save(match);

                        // 참가자에게 결과 푸시
                        sseService.sendToUser(match.getUser1().getId(), result);
                        sseService.sendToUser(match.getUser2().getId(), result);
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        });
        workerThread.setName("RedisWorker");
        workerThread.start();
    }
}