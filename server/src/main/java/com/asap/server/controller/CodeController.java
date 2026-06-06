package com.asap.server.controller;

import java.util.List;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
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
import com.asap.server.dto.request.ManualSubmissionRequest;
import com.asap.server.dto.response.CodeSubmitResponse;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.CodeBattleExampleAIRepository;
import com.asap.server.repository.CodeBattleMatchRepository;
import com.asap.server.repository.CodeBattleParticipantRepository;
import com.asap.server.repository.CodeBattleSubmissionRepository;
import com.asap.server.repository.usersRepository;
import com.asap.server.service.S3Service;
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
    private final S3Service s3Service;

    private static final String CODE_BATTLE_GRADING_QUEUE_KEY = "code_battle_grading_queue";
    private static final String CODE_BATTLE_TEST_QUEUE_KEY = "code_battle_test_queue";

    @PostMapping("/submit/codebattle")
    @Operation(description = "language는 eunm 타입입니다. (CPP,PYTHON,JAVA,C)")
    public ResponseEntity<CodeSubmitResponse> submitBattle(@Valid @RequestBody CodeSubmitRequest request) {
        try {
            CodeBattleContest contest = contestRepository.findById(request.getProblemId())
                    .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 대회입니다."));

            Users user = userRepository.findById(request.getUserId())
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
                    "PENDING");
            submissionRepository.save(submission);

            // S3 업로드
            String key = s3Service.buildCodeSubmissionKey(request.getProblemId(),
                    request.getUserId(), submission.getId());
            s3Service.uploadCode(key, request.getSourceCode());

            submission.changeCodeUrl(key);
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
            } else if (participant.getSubmission() == null) {
                log.info("MANUAL 모드이나 기존 제출 없음 - 최초 제출 코드 저장");
                participant.setSubmission(submission);
                participantRepository.save(participant);
            } else {
                log.info("MANUAL 모드 - 최신 제출 코드 저장 스킵 (기존 선택 유지)");
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
            CodeBattleContest contest = contestRepository.findById(request.getProblemId())
                    .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 대회입니다."));

            if (request.getUserId() == null) {
                return ResponseEntity.badRequest().body("userId는 필수입니다.");
            }
            ObjectNode rootNode = objectMapper.createObjectNode();
            rootNode.put("submissionId", contest.getId());
            rootNode.put("timeLimitSec", contest.getTimeLimitSec());
            rootNode.put("memoryLimitMb", contest.getMemoryLimitMB());
            rootNode.put("aiOrder", 0L);
            rootNode.put("userId", request.getUserId());

            // 검증 큐는 현재 다른 큐와 형식 불일치
            rootNode.put("judge", contest.getJudgeCode());
            rootNode.put("player1", request.getSourceCode1());
            rootNode.put("player2", request.getSourceCode2());

            ObjectNode languagesNode = rootNode.putObject("languages");
            languagesNode.put("judge", "cpp");
            languagesNode.put("player1", request.getLanguage1().name().toLowerCase());
            languagesNode.put("player2", request.getLanguage2().name().toLowerCase());

            String jsonPayload = objectMapper.writeValueAsString(rootNode);
            redisTemplate.opsForList().leftPush(CODE_BATTLE_TEST_QUEUE_KEY, jsonPayload);

            return ResponseEntity.ok("채점 대기열에 등록되었습니다.");

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/submit/codebattle/{contestId}/codeSelect")
    @Operation(description = "MANUAL 모드로 전환하고 지정한 제출 코드를 최종 코드로 저장합니다.")
    public ResponseEntity<CodeSubmitResponse> manualSelectSubmission(
            @PathVariable Long contestId,
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody ManualSubmissionRequest request) {
        try {
            CodeBattleSubmission submission = submissionRepository.findById(request.getSubmissionId())
                    .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 제출입니다."));

            if (!contestId.equals(submission.getContest().getId())) {
                throw new IllegalArgumentException("해당 대회의 제출이 아닙니다.");
            }

            CodeBattleParticipant participant = participantRepository
                    .findByUserIdAndContestId(userId, contestId)
                    .orElseThrow(() -> new IllegalArgumentException("대회 참가 이력이 없습니다."));

            // MANUAL 모드로 전환 + 선택한 제출 저장
            participant.setManual(true);
            participant.setSubmission(submission);
            participantRepository.save(participant);

            log.info("MANUAL 모드 전환 및 제출 코드 저장 - userId: {}, submissionId: {}", userId, request.getSubmissionId());

            return ResponseEntity.ok(new CodeSubmitResponse(true,
                    "수동 제출 설정 완료 (submissionId: " + request.getSubmissionId() + ")"));

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new CodeSubmitResponse(false, e.getMessage()));
        }
    }
}