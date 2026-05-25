package com.asap.server.controller;

import java.util.List;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleExampleAI;
import com.asap.server.domain.CodeBattleMatch;
import com.asap.server.domain.CodeBattleParticipant;
import com.asap.server.domain.CodeBattleSubmission;
import com.asap.server.domain.Users;
import com.asap.server.dto.request.CodeBattleTestRequest;
import com.asap.server.dto.request.CodeSubmitRequest;
import com.asap.server.dto.response.CodeSubmitResponse;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.CodeBattleExampleAIRepository;
import com.asap.server.repository.CodeBattleMatchRepository;
import com.asap.server.repository.CodeBattleParticipantRepository;
import com.asap.server.repository.CodeBattleSubmissionRepository;
import com.asap.server.repository.usersRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    private final usersRepository userRepository;
    private final CodeBattleExampleAIRepository exampleAIRepository;
    private final CodeBattleMatchRepository matchRepository;
    private final CodeBattleContestRepository contestRepository;
    private final CodeBattleSubmissionRepository submissionRepository;
    private final CodeBattleParticipantRepository participantRepository;

    private static final String SUBMISSION_COUNT_KEY = "submission_count";
    private static final String CODE_BATTLE_GRADING_QUEUE_KEY = "code_battle_grading_queue";
    private static final String CODE_BATTLE_TEST_QUEUE_KEY = "code_battle_test_queue";

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
            // 참가자 테이블을 조회한다
            Long userId = submission.getUser().getId();
            Long contestId = submission.getContest().getId();

            CodeBattleParticipant participant = participantRepository
                    .findByUserIdAndContestId(userId, contestId)
                    .orElse(null);
            // 참가 신청 이력이 없으면 최종 제출을 기록할 수 없다.
            if (participant == null) {
                log.info("참가 이력이 없어 최종 제출을 건너뜁니다.");
            }
            // AUTO 모드면 최신 제출로 갱신, MANUAL 모드는 사용자 선택 유지
            else if (!participant.isManual()) {
                log.info("최신 제출 코드를 저장");
                participant.setSubmission(submission);
                participantRepository.save(participant);
            }
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

                ObjectNode rootNode = objectMapper.createObjectNode();
                rootNode.put("submissionId", submission.getId());
                rootNode.put("timeLimitSec", contest.getTimeLimitSec());
                rootNode.put("memoryLimitMb", contest.getMemoryLimitMB());
                rootNode.put("aiOrder", ai.getExampleOrder());

                ObjectNode codesNode = rootNode.putObject("codes");
                codesNode.put("judge", contest.getJudgeCode());
                codesNode.put("player1", request.getSourceCode());
                codesNode.put("player2", ai.getCode());

                ObjectNode languagesNode = rootNode.putObject("languages");
                languagesNode.put("judge", "cpp");
                languagesNode.put("player1", request.getLanguage().name().toLowerCase());
                languagesNode.put("player2", ai.getLanguage().name().toLowerCase());

                String jsonPayload = objectMapper.writeValueAsString(rootNode);
                redisTemplate.opsForList().leftPush(CODE_BATTLE_GRADING_QUEUE_KEY, jsonPayload);
            }

            return ResponseEntity.ok(new CodeSubmitResponse(true, "코드 배틀 제출 완료 (ID: " + submission.getId() + ")"));

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new CodeSubmitResponse(false, e.getMessage()));
        }
    }

    // 현재 CPP만 지원
    @PostMapping("/submit/test")
    public ResponseEntity<String> submitCodeBattleTest(@Valid @RequestBody CodeBattleTestRequest request) {
        try {
            CodeBattleContest contest = contestRepository.findById(Long.parseLong(request.getProblemId()))
                    .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 대회입니다."));

            Users user = userRepository.findById(Long.parseLong(request.getUserId()))
                    .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 유저입니다."));

            ObjectNode rootNode = objectMapper.createObjectNode();
            rootNode.put("submissionId", contest.getId());
            rootNode.put("timeLimitSec", contest.getTimeLimitSec());
            rootNode.put("memoryLimitMb", contest.getMemoryLimitMB());
            rootNode.put("aiOrder", 0L);

            ObjectNode codesNode = rootNode.putObject("codes");
            codesNode.put("judge", contest.getJudgeCode());
            codesNode.put("player1", request.getSourceCode1());
            codesNode.put("player2", request.getSourceCode2());

            ObjectNode languagesNode = rootNode.putObject("languages");
            languagesNode.put("judge", request.getLanguage1().name());
            languagesNode.put("player1", request.getLanguage2().name());
            languagesNode.put("player2", request.getLanguage3().name());

            String jsonPayload = objectMapper.writeValueAsString(rootNode);
            redisTemplate.opsForList().leftPush(CODE_BATTLE_TEST_QUEUE_KEY, jsonPayload);

            return ResponseEntity.ok("채점 대기열에 등록되었습니다.");

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}