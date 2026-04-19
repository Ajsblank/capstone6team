package com.asap.server.controller;

import com.asap.server.domain.AlgorithmProblem;
import com.asap.server.dto.request.CodeSubmitRequest;
import com.asap.server.dto.response.CodeSubmitResponse;
import com.asap.server.repository.AlgorithmProblemRepository; // 레포지토리 주입 필요
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/code")
@RequiredArgsConstructor
public class CodeController {

    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;
    private final AlgorithmProblemRepository problemRepository; // DB 조회를 위한 레포지토리

    private static final String SUBMISSION_COUNT_KEY = "submission_count";
    private static final String GRADING_QUEUE_KEY = "algorithms_grading_queue";

    @PostMapping("/submit")
    public ResponseEntity<CodeSubmitResponse> submitCode(@Valid @RequestBody CodeSubmitRequest request) {
        
        try {
            // DB에서 문제 정보 조회
            AlgorithmProblem problem = problemRepository.findById(Long.parseLong(request.getProblemId()))
                    .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 문제 ID입니다."));

            // Redis에서 순차 ID 생성
            Long nextId = redisTemplate.opsForValue().increment(SUBMISSION_COUNT_KEY);
            String submissionId = String.valueOf(nextId);

            // C++ 서버 전용 JSON Payload 구성
            ObjectNode rootNode = objectMapper.createObjectNode();
            rootNode.put("submissionId", submissionId);
            rootNode.put("code", request.getSourceCode());
            rootNode.put("language", request.getLanguage());
            rootNode.put("timeLimitSec", problem.getTimeLimitSec());
            rootNode.put("memoryLimitMB", problem.getMemoryLimitMB());

            // 테스트케이스 합치기
            ArrayNode testcasesNode = rootNode.putArray("testcases");
            
            List<AlgorithmProblem.TestCase> allTestCases = new ArrayList<>();
            if (problem.getExampleTestcases() != null) allTestCases.addAll(problem.getExampleTestcases());
            if (problem.getHiddenTestcases() != null) allTestCases.addAll(problem.getHiddenTestcases());

            for (AlgorithmProblem.TestCase tc : allTestCases) {
                ObjectNode tcNode = testcasesNode.addObject();
                tcNode.put("input", tc.getInput());
                tcNode.put("output", tc.getOutput());
            }

            // Redis 전송
            String jsonPayload = objectMapper.writeValueAsString(rootNode);
            redisTemplate.opsForList().leftPush(GRADING_QUEUE_KEY, jsonPayload);
            
            log.info("채점 요청 성공 - ID: {}, 문제: {}", submissionId, problem.getTitle());

            return ResponseEntity.ok(new CodeSubmitResponse(true, "제출 성공! (ID: " + submissionId + ")"));

        } catch (Exception e) {
            log.error("채점 요청 실패: {}", e.getMessage());
            return ResponseEntity.badRequest().body(new CodeSubmitResponse(false, e.getMessage()));
        }
    }
}