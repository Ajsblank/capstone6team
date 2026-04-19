package com.asap.server.service;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.asap.server.domain.AlgorithmProblem;
import com.asap.server.repository.AlgorithmProblemRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProblemService {

    private final AlgorithmProblemRepository algorithmProblemRepository;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Transactional
    public AlgorithmProblem createProblem(AlgorithmProblem problem) {
        // DB 저장
        AlgorithmProblem savedProblem = algorithmProblemRepository.save(problem);

        // Redis 캐싱
        updateTestCaseCache(savedProblem);

        return savedProblem;
    }

    private void updateTestCaseCache(AlgorithmProblem problem) {
        try {
            String key = "problem:" + problem.getId() + ":testcases";
            // 히든 테스트케이스 리스트를 JSON 문자열로 변환
            String value = objectMapper.writeValueAsString(problem.getHiddenTestcases());
            redisTemplate.opsForValue().set(key, value);
            log.info("Redis 캐시 업데이트 완료: {}", key);
        } catch (JsonProcessingException e) {
            log.error("테스트케이스 JSON 변환 실패", e);
        }
    }
}