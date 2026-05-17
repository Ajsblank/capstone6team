package com.asap.server.controller;

import java.util.ArrayList;
import java.util.List;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.asap.server.domain.AlgorithmProblem;
import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleExampleAI;
import com.asap.server.domain.CodeBattleMatch;
import com.asap.server.domain.CodeBattleParticipant;
import com.asap.server.domain.CodeBattleSubmission;
import com.asap.server.domain.Users;
import com.asap.server.dto.request.CodeBattleTestRequest;
import com.asap.server.dto.request.CodeSubmitRequest;
import com.asap.server.dto.response.CodeSubmitResponse;
import com.asap.server.repository.AlgorithmProblemRepository;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.CodeBattleExampleAIRepository;
import com.asap.server.repository.CodeBattleMatchRepository;
import com.asap.server.repository.CodeBattleParticipantRepository;
import com.asap.server.repository.CodeBattleSubmissionRepository;
import com.asap.server.repository.usersRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/api/code")
@RequiredArgsConstructor
public class CodeController {

    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;
    private final AlgorithmProblemRepository problemRepository; // DB 조회를 위한 레포지토리
    private final usersRepository userRepository;
    private final CodeBattleExampleAIRepository exampleAIRepository;
    private final CodeBattleMatchRepository matchRepository;
    private final CodeBattleContestRepository contestRepository;
    private final CodeBattleSubmissionRepository submissionRepository;
    private final CodeBattleParticipantRepository participantRepository;
    private static final String SUBMISSION_COUNT_KEY = "submission_count";
    private static final String GRADING_QUEUE_KEY = "algorithms_grading_queue";
    private static final String CODE_BATTLE_GRADING_QUEUE_KEY = "code_battle_grading_queue";
    private static final String CODE_BATTLE_TEST_QUEUE_KEY = "code_battle_test_queue";

    @PostMapping("/submit")
    @Operation(description = "language는 eunm 타입입니다. (CPP,PYTHON,JAVA,C)")
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
            rootNode.put("language", request.getLanguage().name());
            rootNode.put("timeLimitSec", problem.getTimeLimitSec());
            rootNode.put("memoryLimitMb", problem.getMemoryLimitMb());

            // 테스트케이스 합치기
            ArrayNode testcasesNode = rootNode.putArray("testcases");

            List<AlgorithmProblem.TestCase> allTestCases = new ArrayList<>();
            if (problem.getExampleTestcases() != null)
                allTestCases.addAll(problem.getExampleTestcases());
            if (problem.getHiddenTestcases() != null)
                allTestCases.addAll(problem.getHiddenTestcases());

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

    @PostMapping("/submit/codebattle")
    @Operation(description = "language는 eunm 타입입니다. (CPP,PYTHON,JAVA,C)")
    public ResponseEntity<CodeSubmitResponse> submitBattle(@Valid @RequestBody CodeSubmitRequest request) {
        try {
            CodeBattleContest contest = contestRepository.findById(Long.parseLong(request.getProblemId()))
                    .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 대회입니다."));

            Users user = userRepository.findById(Long.parseLong(request.getUserId()))
                    .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 유저입니다."));

            List<CodeBattleExampleAI> aiList = exampleAIRepository
                    .findByContestIdOrderByExampleOrderAsc(contest.getId());

            if (aiList.isEmpty()) {
                throw new IllegalArgumentException("대회에 등록된 예시 AI가 없어 채점을 시작할 수 없습니다.");
            }

            CodeBattleSubmission submission = new CodeBattleSubmission(
                    user,
                    contest,
                    request.getLanguage(),
                    request.getSourceCode(),
                    "PENDING");
            submissionRepository.save(submission);
            log.info("코드 제출 완료");
            for (CodeBattleExampleAI ai : aiList) {
                Users aiUser = userRepository.getReferenceById(1L);
                Users submitter = submission.getUser();

                CodeBattleMatch aiMatch = new CodeBattleMatch(
                        contest,
                        submitter, // user1 (제출자)
                        aiUser, // user2 (AI, ID 1)
                        null, // winner
                        null, // log
                        ai.getExampleOrder());
                aiMatch.setSubmission(submission);
                matchRepository.save(aiMatch);
                log.info("ai 매치 생성 완료 id = {}", ai.getExampleOrder());

                ObjectNode rootNode = objectMapper.createObjectNode();

                rootNode.put("submissionId", submission.getId());
                rootNode.put("aiOrder", ai.getExampleOrder());
                rootNode.put("language", request.getLanguage().name());
                rootNode.put("timeLimitSec", contest.getTimeLimitSec());
                rootNode.put("memoryLimitMb", contest.getMemoryLimitMB());

                ObjectNode codesNode = rootNode.putObject("codes");
                codesNode.put("judge", contest.getJudgeCode());
                codesNode.put("player1", request.getSourceCode());
                codesNode.put("player2", ai.getCode());

                String jsonPayload = objectMapper.writeValueAsString(rootNode);
                redisTemplate.opsForList().leftPush(CODE_BATTLE_GRADING_QUEUE_KEY, jsonPayload);
                log.info("{}번 ai 매치 큐 전송 완료");
            }
            log.info("\"코드 배틀 제출 완료 (ID: {} )", submission.getId());

            Long userId = submission.getUser().getId();
            Long contestId = submission.getContest().getId();

            CodeBattleParticipant participant = participantRepository
                    .findByUserIdAndContestId(userId, contestId)
                    .orElse(null);

            // 참가 신청 이력이 없으면 최종 제출을 기록할 수 없다.
            if (participant == null) {
                log.info("참가 신청 이력이 없어 최종 제출 스킵");
            }
            // AUTO 모드면 최신 제출로 갱신, MANUAL 모드는 사용자 선택 유지
            else if (!participant.isManual()) {
                participant.setSubmission(submission);
                participantRepository.save(participant);
            }
            return ResponseEntity.ok(new CodeSubmitResponse(true, "코드 배틀 제출 완료 (ID: " + submission.getId() + ")"));

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new CodeSubmitResponse(false, e.getMessage()));
        }
    }

    @PostMapping("/submit/test")
    public ResponseEntity<String> submitCodeBattleTest(@Valid @RequestBody CodeBattleTestRequest request) {
        try {
            CodeBattleContest contest = contestRepository.findById(Long.parseLong(request.getProblemId()))
                    .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 대회입니다."));

            Users user = userRepository.findById(Long.parseLong(request.getUserId()))
                    .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 유저입니다."));

            ObjectNode rootNode = objectMapper.createObjectNode();

            rootNode.put("userId", request.getUserId());
            rootNode.put("judge", contest.getJudgeCode());
            rootNode.put("player1", request.getSourceCode1());
            rootNode.put("player2", request.getSourceCode2());

            String jsonPayload = objectMapper.writeValueAsString(rootNode);
            redisTemplate.opsForList().leftPush(CODE_BATTLE_TEST_QUEUE_KEY, jsonPayload);

            return ResponseEntity.ok("채점 대기열에 등록되었습니다.");

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}