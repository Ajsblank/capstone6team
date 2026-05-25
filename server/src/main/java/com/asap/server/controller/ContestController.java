package com.asap.server.controller;

import java.net.URI;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.asap.server.config.CustomUserDetails;
import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.ContestSwissSession;
import com.asap.server.dto.request.ContestScheduleRequest;
import com.asap.server.dto.request.CreateCertifiedContestRequest;
import com.asap.server.dto.request.CreateUncertifiedContestRequest;
import com.asap.server.dto.request.UpdateContestCertifiedRequest;
import com.asap.server.dto.request.UpdateContestRequest;
import com.asap.server.dto.response.CodeBattleMySubmissionResponse;
import com.asap.server.dto.response.ContestDetailResponse;
import com.asap.server.dto.response.ContestListResponse;
import com.asap.server.dto.response.ContestResponse;
import com.asap.server.dto.response.ContestScheduleListResponse;
import com.asap.server.dto.response.ContestScheduleResponse;
import com.asap.server.dto.response.FinalResultResponse;
import com.asap.server.global.type.ContestStatus;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.ContestSwissSessionRepository;
import com.asap.server.service.ContestService;
import com.asap.server.service.FullLeagueService;
import com.asap.server.service.S3Service;
import com.asap.server.service.SseService;
import com.asap.server.service.SwissLeagueService;
import com.fasterxml.jackson.databind.ObjectMapper;

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
    private final S3Service s3Service;
    private final ObjectMapper objectMapper;
    private final CodeBattleContestRepository contestRepository;
    private final FullLeagueService fullLeagueService;
    private final SwissLeagueService swissService;
    private final ContestSwissSessionRepository sessionRepository;
    private final SseService sseService;

    @Operation(summary = "비인증 대회 생성(JSON)", description = "POST /api/contests/create/uncertified application/json")
    @PostMapping(value = "/create/uncertified", consumes = "application/json")
    public ResponseEntity<?> createContest(
            @Valid @RequestBody CreateUncertifiedContestRequest request) {
        log.info("비인증 대회 경로");

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
            @Valid @RequestBody CreateCertifiedContestRequest request) {
        log.info("인증 대회 경로");

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
    public ResponseEntity<ContestScheduleResponse> postSchedule(@PathVariable Long contestId,
            @Valid @RequestBody ContestScheduleRequest request) {
        ContestScheduleResponse response = contestService.saveSchedule(contestId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Operation(summary = "안증 대회 수정", description = "PATCH /api/contests/{contestId}는 대회 메타데이터만 수정합니다. 리소스(visual/solo/judge/sample)는 /api/contests/{contestId}/resource를 사용하세요.")
    @PatchMapping("/{contestId}/modify/certified")
    public ResponseEntity<ContestDetailResponse> updateContestCertified(
            @PathVariable Long contestId,
            @RequestBody UpdateContestCertifiedRequest request) {
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

    @Operation(summary = "비인증 대회 수정", description = "PATCH /api/contests/{contestId}는 대회 메타데이터만 수정합니다. 리소스(visual/solo/judge/sample)는 /api/contests/{contestId}/resource를 사용하세요.")
    @PatchMapping("/{contestId}/modify/uncertified")
    public ResponseEntity<ContestDetailResponse> updateContestUncertified(
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
        List<CodeBattleMySubmissionResponse> responses = contestService.getMySubmissionsWithAi(contestId,
                targetUserId);
        log.info("조회: {}", responses);
        return ResponseEntity.ok(responses);
    }

    @GetMapping("/{contestId}/final-result")
    @Operation(summary = "풀리그 결과 조회", description = "대회 종료 처리 후 기록된 풀리그 결과를 Json 형식으로 반환합니다.")
    public ResponseEntity<?> getFinalResult(@PathVariable Long contestId) {
        try {
            CodeBattleContest contest = contestRepository.findById(contestId)
                    .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 대회입니다."));

            if (contest.getStatus() != ContestStatus.END) {
                return ResponseEntity.badRequest()
                        .body(Map.of("message", "아직 종료되지 않은 대회입니다."));
            }

            String key = s3Service.buildFinalResultKey(contestId);
            String json;
            try {
                json = s3Service.readFileAsString(key);
            } catch (Exception e) {
                // S3 파일 없음 = 종료는 됐지만 아직 집계 중
                return ResponseEntity.accepted()
                        .body(Map.of("message", "아직 집계 중이거나 데이터가 존재하지 않습니다."));
            }
            FinalResultResponse response = objectMapper.readValue(json, FinalResultResponse.class);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            log.error("[풀리그] 최종 결과 조회 실패. contestId={}", contestId, e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("message", "결과 조회 중 오류가 발생했습니다."));
        }
    }

    @Operation(summary = "중간 대회 목록 조회")
    @GetMapping("/{contestId}/schedules")
    public ResponseEntity<List<ContestScheduleListResponse>> getSchedules(@PathVariable Long contestId) {
        return ResponseEntity.ok(contestService.getSchedules(contestId));
    }

    @PostMapping("/{contestId}/final-test")
    public ResponseEntity<String> testFullLeagueGrading(@PathVariable Long contestId) {
        try {
            fullLeagueService.fullLeagueGrading(contestId);
            return ResponseEntity.ok("풀리그 채점 대기열에 등록되었습니다.");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{contestId}/swiss-session-test")
    public ResponseEntity<String> testSwissSession(
            @PathVariable Long contestId,
            @RequestParam int sessionNumber) {
        try {
            CodeBattleContest contest = contestRepository.findById(contestId)
                    .orElseThrow(() -> new IllegalArgumentException("대회를 찾을 수 없습니다. id=" + contestId));
            // 1. 세션 값 초기화
            ContestSwissSession session = new ContestSwissSession();
            session.setContest(contest);
            session = sessionRepository.save(session);

            swissService.generateSwissSession(contestId, sessionNumber, session.getId());
            return ResponseEntity.ok("스위스 세션 " + sessionNumber + " 실행됨. sessionId=" + session.getId());
        } catch (Exception e) {
            log.error("[스위스 테스트] 예외 발생", e);
            return ResponseEntity.badRequest().body(e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    @PostMapping("/{contestId}/swiss-round-aggregate-test")
    public ResponseEntity<String> testSwissRoundAggregate(
            @PathVariable Long contestId,
            @RequestParam Long roundId) {
        try {
            swissService.aggregateSwissRound(roundId);
            return ResponseEntity.ok("라운드 " + roundId + " 집계 완료");
        } catch (Exception e) {
            log.error("[스위스 라운드 집계 테스트] 예외 발생", e);
            return ResponseEntity.badRequest().body(e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    @PostMapping("/{contestId}/swiss-session-aggregate-test")
    public ResponseEntity<String> testSwissSessionAggregate(
            @PathVariable Long contestId,
            @RequestParam int sessionNumber) {
        try {
            ContestSwissSession session = sessionRepository
                    .findByContestIdAndSessionNumber(contestId, sessionNumber)
                    .orElseThrow(() -> new IllegalArgumentException("세션 없음"));
            swissService.aggregateSwissSession(session.getId());
            return ResponseEntity.ok("세션 " + session.getId() + " 집계 완료");
        } catch (Exception e) {
            log.error("[스위스 세션 집계 테스트] 예외 발생", e);
            return ResponseEntity.badRequest().body(e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    @GetMapping(value = "/{contestId}/{sessionId}/subscribe", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "세션 정보 SSE 구독 API", description = "세션의 전체 정보를 받아옵니다.")
    public SseEmitter subscribeSession(
            @PathVariable Long contestId,
            @PathVariable Long sessionId) {
        log.info("[SSE 세션 구독] contestId={} sessionId={}", contestId, sessionId);
        return sseService.subscribeSession(contestId, sessionId);
    }
}
