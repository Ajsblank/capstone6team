package com.asap.server.controller;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.asap.server.config.CustomUserDetails;
import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.ContestSchedule;
import com.asap.server.dto.request.ContestScheduleRequest;
import com.asap.server.dto.request.ContestVerifierRequest;
import com.asap.server.dto.request.CreateCertifiedContestRequest;
import com.asap.server.dto.request.CreateUncertifiedContestRequest;
import com.asap.server.dto.request.UpdateContestRequest;
import com.asap.server.dto.response.CodeBattleMySubmissionResponse;
import com.asap.server.dto.response.ContestDetailResponse;
import com.asap.server.dto.response.ContestListResponse;
import com.asap.server.dto.response.ContestResponse;
import com.asap.server.dto.response.ContestVerifierLogResponse;
import com.asap.server.global.TestResultHolder;
import com.asap.server.global.type.ContestStatus;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.service.CodeBattleSubmissionService;
import com.asap.server.service.ContestService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.Parameters;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Encoding;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/api/contests")
@RequiredArgsConstructor
@Slf4j
public class ContestController {

    private final ContestService contestService;
    private final CodeBattleSubmissionService submissionService;
    private final CodeBattleContestRepository contestRepository;
    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;
    private final TestResultHolder testResultHolder;
    private static final String CODE_BATTLE_TEST_QUEUE_KEY = "code_battle_test_queue";

    @Operation(summary = "비인증 대회 생성(JSON)", description = "POST /api/contests/create/uncertified application/json")
    @PostMapping(value = "/create/uncertified", consumes = "application/json")
    public ResponseEntity<?> createContest(
            @Valid @RequestBody CreateUncertifiedContestRequest request,
            BindingResult bindingResult) {
        if (bindingResult.hasErrors()) {
            bindingResult.getFieldErrors()
                    .forEach(e -> log.error("검증 실패: {} - {}", e.getField(), e.getDefaultMessage()));
            return ResponseEntity.badRequest().body(bindingResult.getFieldErrors());
        }

        // Legacy multipart version kept for reference during the temporary DTO
        // migration.
        // @PostMapping(value = "/create/uncertified", consumes = "multipart/form-data")
        // public ResponseEntity<?> createContest(
        // @RequestPart("request") CreateUncertifiedContestRequest request,
        // @RequestPart(value = "visualFile", required = false) MultipartFile
        // visualFile,
        // @RequestPart(value = "soloFile", required = false) MultipartFile soloFile,
        // @RequestPart("judgeCodeFile") MultipartFile judgeCodeFile,
        // @RequestPart("sampleCodeFile") MultipartFile sampleCodeFile,
        // @RequestPart("exampleAiFiles") List<MultipartFile> exampleAiFiles) {

        try {
            ContestResponse response = contestService.createUncertifiedContest(request.getCreatorId(), request);
            return ResponseEntity.created(URI.create("/api/contests/" + response.getId()))
                    .body(response);
        } catch (IllegalArgumentException e) {
            log.error("인증 대회 생성 실패", e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            log.error("비인증 대회 생성 실패", e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("비인증 대회 생성 실패", e);
            return ResponseEntity.internalServerError().body(Map.of("error", "비인증 대회 생성 중 오류 발생"));
        }
    }

    @Operation(summary = "인증 대회 생성(JSON)", description = "POST /api/contests/create/certified application/json")
    @PostMapping(value = "/create/certified", consumes = "application/json")
    public ResponseEntity<?> createCertifiedContest(
            @Valid @RequestBody CreateCertifiedContestRequest request,
            BindingResult bindingResult) {
        if (bindingResult.hasErrors()) {
            bindingResult.getFieldErrors()
                    .forEach(e -> log.error("검증 실패: {} - {}", e.getField(), e.getDefaultMessage()));
            return ResponseEntity.badRequest().body(bindingResult.getFieldErrors());
        }
        // Legacy multipart version kept for reference during the temporary DTO
        // migration.
        // @PostMapping(value = "/create/certified", consumes = "multipart/form-data")
        // public ResponseEntity<?> createCertifiedContest(
        // @RequestPart("request") CreateCertifiedContestRequest request,
        // @RequestPart("visualFile") MultipartFile visualFile,
        // @RequestPart("soloFile") MultipartFile soloFile,
        // @RequestPart("judgeCodeFile") MultipartFile judgeCodeFile,
        // @RequestPart("sampleCodeFile") MultipartFile sampleCodeFile,
        // @RequestPart("exampleAiFiles") List<MultipartFile> exampleAiFiles) {
        try {
            ContestResponse response = contestService.createCertifiedContest(request.getCreatorId(), request);
            return ResponseEntity.created(URI.create("/api/contests/" + response.getId()))
                    .body(response);
        } catch (IllegalArgumentException e) {
            log.error("인증 대회 생성 실패", e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            log.error("인증 대회 생성 실패", e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("인증 대회 생성 실패", e);
            return ResponseEntity.internalServerError().body(Map.of("error", "인증 대회 생성 중 오류 발생"));
        }
    }

    @GetMapping("/list")
    @Operation(summary = "대회 목록 조회", description = "status로 필터링하고 page, size, sort로 페이징/정렬 조회합니다. status를 지정하지 않으면 전체 조회합니다.")
    @Parameters({
            @Parameter(in = ParameterIn.QUERY, name = "status", description = "대회 상태 필터 (선택). 허용값: TEST, PLANNED, RUNNING, PAUSED, END", schema = @Schema(type = "string", allowableValues = {
                    "TEST", "PLANNED", "RUNNING", "PAUSED", "END" }, example = "RUNNING")),
            @Parameter(in = ParameterIn.QUERY, name = "page", description = "페이지 번호 (0부터 시작)", schema = @Schema(type = "integer", defaultValue = "0", example = "0")),
            @Parameter(in = ParameterIn.QUERY, name = "size", description = "페이지 크기", schema = @Schema(type = "integer", defaultValue = "20", example = "20")),
            @Parameter(in = ParameterIn.QUERY, name = "sort", description = "정렬 기준 (사용법: 컬럼명,asc|desc)", array = @ArraySchema(schema = @Schema(type = "string", example = "id,desc")))
    })
    public ResponseEntity<Page<ContestListResponse>> getContestList(
            @RequestParam(required = false) ContestStatus status,
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.DESC) Pageable pageable) {
        Page<ContestListResponse> responses = contestService.getContestPage(status, pageable);
        return ResponseEntity.ok(responses);
    }

    @Operation(summary = "대회 상세 조회")
    @GetMapping("/{contestId}")
    public ResponseEntity<ContestResponse> getContestDetail(@PathVariable Long contestId) {
        return ResponseEntity.ok(contestService.getContestResponse(contestId));
    }

    @Operation(summary = "대회 상세 조회(채점 코드 포함)")
    @GetMapping("/{contestId}/admin")
    public ResponseEntity<ContestDetailResponse> getContestDetailAdmin(@PathVariable Long contestId) {
        return ResponseEntity.ok(contestService.getContestDetailResponse(contestId));
    }

    @Operation(summary = "중간 대회 일정 추가")
    @PostMapping("/{contestId}/admin")
    public ResponseEntity<ContestSchedule> postSchedule(@PathVariable Long contestId,
            @RequestBody ContestScheduleRequest request) {
        ContestSchedule schedule = contestService.saveSchedule(contestId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(schedule);
    }

    @Operation(summary = "대회 수정", description = "PATCH /api/contests/{contestId}는 대회 메타데이터만 수정합니다. 리소스(visual/solo/judge/sample)는 /api/contests/{contestId}/resource를 사용하세요.")
    @PatchMapping("/{contestId}")
    public ResponseEntity<ContestDetailResponse> updateContest(
            @PathVariable Long contestId,
            @RequestBody UpdateContestRequest request) {
        try {
            ContestDetailResponse response = contestService.updateContest(contestId, request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(null);
        } catch (Exception e) {
            log.error("대회 수정 실패 - contestId: {}", contestId, e);
            return ResponseEntity.internalServerError().body(null);
        }
    }

    @Operation(summary = "대회 리소스 수정", description = "PATCH /api/contests/{contestId}/resource multipart/form-data로 리소스를 선택적으로 덮어씁니다. 업로드한 파트만 수정됩니다.")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true, content = @Content(mediaType = "multipart/form-data", encoding = {
            @Encoding(name = "visualFile", contentType = "text/html"),
            @Encoding(name = "soloFile", contentType = "text/html"),
            @Encoding(name = "judgeCodeFile", contentType = "text/x-c++src"),
            @Encoding(name = "sampleCodeFile", contentType = "text/x-c++src"),
            @Encoding(name = "exampleAiFiles", contentType = "text/x-c++src")
    }))
    @PatchMapping(value = "/{contestId}/resource", consumes = "multipart/form-data")
    public ResponseEntity<ContestDetailResponse> updateContestResources(
            @PathVariable Long contestId,
            @RequestPart(value = "visualFile", required = false) MultipartFile visualFile,
            @RequestPart(value = "soloFile", required = false) MultipartFile soloFile,
            @RequestPart(value = "judgeCodeFile", required = false) MultipartFile judgeCodeFile,
            @RequestPart(value = "sampleCodeFile", required = false) MultipartFile sampleCodeFile,
            @RequestPart(value = "exampleAiFiles", required = false) List<MultipartFile> exampleAiFiles) {
        try {
            ContestDetailResponse response = contestService.updateContestResources(
                    contestId,
                    visualFile,
                    soloFile,
                    judgeCodeFile,
                    sampleCodeFile,
                    exampleAiFiles);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(null);
        } catch (Exception e) {
            log.error("대회 리소스 수정 실패 - contestId: {}", contestId, e);
            return ResponseEntity.internalServerError().body(null);
        }
    }

    @GetMapping("/{contestId}/{targetUserId}")
    @Operation(summary = "내 제출 및 AI 결과 조회", description = "내가 해당 대회에 제출한 코드와 샘플 AI와의 대결 결과를 조회합니다.")
    public ResponseEntity<List<CodeBattleMySubmissionResponse>> getMySubmissions(
            @PathVariable Long contestId,
            @PathVariable Long targetUserId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        log.info("조회 시도: {} / {}", contestId, targetUserId);
        List<CodeBattleMySubmissionResponse> responses = submissionService.getMySubmissionsWithAi(contestId,
                targetUserId);
        log.info("조회: {}", responses);
        return ResponseEntity.ok(responses);
    }

    @Operation(summary = "대회 검수 API", description = "두 개의 코드를 비교하여 검증합니다.")
    @PostMapping("/{contestId}/review")
    public ResponseEntity<ContestVerifierLogResponse> contestVerifier(
            @PathVariable Long contestId,
            @Valid @RequestBody ContestVerifierRequest request) {
        try {
            CodeBattleContest contest = contestRepository.findById(contestId)
                    .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 대회입니다."));

            CompletableFuture<String> future = testResultHolder.register(contestId);
            // Redis 검수 요청 JSON Payload 구성
            ObjectNode rootNode = objectMapper.createObjectNode();
            rootNode.put("contestId", contestId);
            rootNode.put("language1", request.getLanguage1().name());
            rootNode.put("language2", request.getLanguage2().name());
            rootNode.put("timeLimitSec", contest.getTimeLimitSec());
            rootNode.put("memoryLimitMb", contest.getMemoryLimitMB());

            ObjectNode codesNode = rootNode.putObject("codes");
            codesNode.put("judge", contest.getJudgeCode());
            codesNode.put("player1", request.getCode1());
            codesNode.put("player2", request.getCode2());

            String jsonPayload = objectMapper.writeValueAsString(rootNode);
            redisTemplate.opsForList().leftPush(CODE_BATTLE_TEST_QUEUE_KEY, jsonPayload);

            String log = future.get(60, TimeUnit.SECONDS);
            return ResponseEntity.ok(new ContestVerifierLogResponse(log));
        } catch (TimeoutException e) {
            testResultHolder.complete(contestId, null);
            return ResponseEntity.status(408).body(new ContestVerifierLogResponse("채점 시간 초과"));
        } catch (IllegalArgumentException e) {
            log.warn("대회 검수 요청 실패 - contestId: {}, message: {}", contestId, e.getMessage());
            return ResponseEntity.badRequest().body(new ContestVerifierLogResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("대회 검수 요청 실패 - contestId: {}", contestId, e);
            return ResponseEntity.internalServerError().body(new ContestVerifierLogResponse("검수 요청 처리 중 오류 발생"));
        }
    }
}
