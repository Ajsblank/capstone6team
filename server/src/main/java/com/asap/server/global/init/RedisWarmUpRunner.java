package com.asap.server.global.init;

import java.util.List;

import org.springframework.boot.CommandLineRunner;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import com.asap.server.domain.AlgorithmProblem;
import com.asap.server.repository.AlgorithmProblemRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class RedisWarmUpRunner implements CommandLineRunner {

    private final AlgorithmProblemRepository algorithmProblemRepository;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public void run(String... args) {
        log.info("Redis 캐시 웜업 시작...");
        
        List<AlgorithmProblem> problems = algorithmProblemRepository.findAll();
        
        for (AlgorithmProblem problem : problems) {
            try {
                if (problem.getHiddenTestcases() != null) {
                    String key = "problem:" + problem.getId() + ":testcases";
                    String value = objectMapper.writeValueAsString(problem.getHiddenTestcases());
                    redisTemplate.opsForValue().set(key, value);
                }
            } catch (JsonProcessingException e) {
                log.error("문제 {}의 테스트케이스 캐싱 실패", problem.getId(), e);
            }
        }
        
        log.info("Redis 캐시 웜업 완료! (총 {}건)", problems.size());
    }
}