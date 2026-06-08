package com.asap.server.controller;

import java.io.IOException;
import java.net.URI;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

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
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.asap.server.config.CustomUserDetails;
import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleMatch;
import com.asap.server.domain.ContestSwissMatch;
import com.asap.server.domain.ContestSwissSession;
import com.asap.server.dto.request.CreateCertifiedContestRequest;
import com.asap.server.dto.request.CreateUncertifiedContestRequest;
import com.asap.server.dto.request.UpdateContestCertifiedRequest;
import com.asap.server.dto.request.UpdateContestRequest;
import com.asap.server.dto.request.ValidateContestRequest;
import com.asap.server.dto.response.CodeBattleMySubmissionResponse;
import com.asap.server.dto.response.ContestDetailResponse;
import com.asap.server.dto.response.ContestListResponse;
import com.asap.server.dto.response.ContestResponse;
import com.asap.server.dto.response.ContestSessionListResponse;
import com.asap.server.dto.response.FinalResultResponse;
import com.asap.server.dto.response.SwissLeaderBoardResponse;
import com.asap.server.dto.response.SwissMiddleRankResponse;
import com.asap.server.dto.response.SwissResultResponse;
import com.asap.server.global.type.ContestStatus;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.CodeBattleMatchRepository;
import com.asap.server.repository.ContestSwissMatchRepository;
import com.asap.server.repository.ContestSwissSessionRepository;
import com.asap.server.repository.ProfileRepository;
import com.asap.server.service.ContestRunService;
import com.asap.server.service.ContestService;
import com.asap.server.service.FullLeagueService;
import com.asap.server.service.S3Service;
import com.asap.server.service.SseService;
import com.asap.server.service.SwissLeagueService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.Parameters;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.EntityNotFoundException;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/api/contests")
@RequiredArgsConstructor
@Slf4j
public class ContestController {

    private final ContestService contestService;
    private final ContestRunService contestRunService;
    private final S3Service s3Service;
    private final ObjectMapper objectMapper;
    private final CodeBattleContestRepository contestRepository;
    private final FullLeagueService fullLeagueService;
    private final SwissLeagueService swissService;
    private final ContestSwissSessionRepository sessionRepository;
    private final SseService sseService;
    private final ContestSwissMatchRepository swissMatchRepository;
    private final CodeBattleMatchRepository matchRepository;
    private final ProfileRepository profileRepository;

    @Operation(summary = "비인증 대회 생성(JSON)", description = "POST /api/contests/create/uncertified application/json")
    @PostMapping(value = "/create/uncertified", consumes = "application/json")
    public ResponseEntity<?> createContest(
            @Valid @RequestBody CreateUncertifiedContestRequest request) {
        log.info("비인증 대회 경로");

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
    public ResponseEntity<ContestDetailResponse> getContestDetailAdmin(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long contestId) {
        CodeBattleContest contest = contestRepository.findById(contestId)
                .orElseThrow(() -> new IllegalArgumentException("대회를 찾을 수 없습니다."));
        if (!contest.getCreator().getId().equals(userId)) {
            log.info("대회 개최자와 일치하지 않는 유저 contestId={} userId={}", contestId, userId);
            return ResponseEntity.status(403).body(null);
        }
        return ResponseEntity.ok(contestService.getContestDetailResponse(contestId));
    }

    @Operation(summary = "안증 대회 수정", description = "PATCH /api/contests/{contestId}는 대회 메타데이터만 수정합니다. 리소스(visual/solo/judge/sample)는 /api/contests/{contestId}/resource를 사용하세요.")
    @PatchMapping("/{contestId}/modify/certified")
    public ResponseEntity<ContestDetailResponse> updateContestCertified(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long contestId,
            @RequestBody UpdateContestCertifiedRequest request) {
        try {
            CodeBattleContest contest = contestRepository.findById(contestId)
                    .orElseThrow(() -> new IllegalArgumentException("대회를 찾을 수 없습니다."));
            if (!contest.getCreator().getId().equals(userId)) {
                log.info("대회 개최자와 일치하지 않는 유저 contestId={} userId={}", contestId, userId);
                return ResponseEntity.status(403).body(null);
            }
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
            @AuthenticationPrincipal Long userId,
            @PathVariable Long contestId,
            @RequestBody UpdateContestRequest request) {
        try {
            CodeBattleContest contest = contestRepository.findById(contestId)
                    .orElseThrow(() -> new IllegalArgumentException("대회를 찾을 수 없습니다."));
            if (!contest.getCreator().getId().equals(userId)) {
                log.info("대회 개최자와 일치하지 않는 유저 contestId={} userId={}", contestId, userId);
                return ResponseEntity.status(403).body(null);
            }
            ContestDetailResponse response = contestService.updateContest(contestId, request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(null);
        } catch (Exception e) {
            log.error("대회 수정 실패 - contestId: {}", contestId, e);
            return ResponseEntity.internalServerError().body(null);
        }
    }

    // 대회 리소스 수정 부분 추가 필요

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

            // if (contest.getStatus() != ContestStatus.END) {
            // return ResponseEntity.badRequest()
            // .body(Map.of("message", "아직 종료되지 않은 대회입니다."));
            // }
            if (contest.getStatus() != ContestStatus.END) {
                log.info("end 상태가 아니지만 임시 조회 허용합니다.");
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
            Map<Long, String> nicknameTagMap = getNicknameTagMap(
                    response.getFinalStandings().stream().map(FinalResultResponse.StandingDto::getUserId).toList());
            response.getFinalStandings()
                    .forEach(s -> s.setNicknameTag(nicknameTagMap.getOrDefault(s.getUserId(), "")));
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            log.error("[풀리그] 최종 결과 조회 실패. contestId={}", contestId, e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("message", "결과 조회 중 오류가 발생했습니다."));
        }
    }

    @Operation(summary = "스위스 세션 목록 조회", description = "세션 번호별 최신 세션 하나씩 반환합니다.")
    @GetMapping("/{contestId}/sessionList")
    public ResponseEntity<List<ContestSessionListResponse>> getSessionList(@PathVariable Long contestId) {
        List<ContestSessionListResponse> responses = sessionRepository.findByContestId(contestId)
                .stream()
                .filter(s -> s.getSessionNumber() != null)
                .collect(Collectors.toMap(
                        ContestSwissSession::getSessionNumber,
                        s -> s,
                        (a, b) -> b.getId() > a.getId() ? b : a))
                .values()
                .stream()
                .sorted(Comparator.comparing(ContestSwissSession::getSessionNumber))
                .map(ContestSessionListResponse::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(responses);
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

    @PostMapping("/{contestId}/temporarySessionTest")
    @Operation(summary = "세션을 생성 실행합니다.", description = "대회에 세션을 새로 생성하고 강제 실행합니다.")
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

    @GetMapping(value = "/{contestId}/{sessionNumber}/subscribe", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "세션 정보 SSE 구독 API", description = "sessionNumber로 최신 세션을 찾아 SSE 구독합니다.")
    public SseEmitter subscribeSession(
            @PathVariable Long contestId,
            @PathVariable int sessionNumber,
            HttpServletResponse response) {

        ContestSwissSession session = sessionRepository
                .findTopByContestIdAndSessionNumberOrderByIdDesc(contestId, sessionNumber)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "세션을 찾을 수 없습니다."));

        log.info("[SSE 세션 구독 요청] contestId={} sessionNumber={} sessionId={} status={}",
                contestId, sessionNumber, session.getId(), session.getStatus());
        // nginx sse 버퍼링 방지
        response.setHeader("Cache-Control", "no-cache");
        // 브라우저 캐시 방지
        response.setHeader("X-Accel-Buffering", "no");
        return switch (session.getStatus()) {
            case RUNNING -> {
                // 캐시 없으면 DB에서 복원
                if (sseService.getSessionState(contestId, session.getId()) == null) {
                    swissService.restoreSessionState(contestId, session.getId());
                }
                log.info("[SSE 세션 구독] contestId={} sessionNumber={} sessionId={}",
                        contestId, sessionNumber, session.getId());
                yield sseService.subscribeSession(contestId, session.getId());
            }
            case END -> {
                // 종료된 세션: DB에서 최종 결과를 가져와 단발성 SSE로 전달 후 즉시 close
                SseEmitter emitter = new SseEmitter(0L);
                try {
                    String key = s3Service.buildSessionResultKey(contestId, sessionNumber);
                    try {
                        String json = s3Service.readFileAsString(key);
                        SwissResultResponse result = objectMapper.readValue(json, SwissResultResponse.class);
                        // DTO에 없는 필드를 Map으로 보완
                        Map<String, Object> response_ = new LinkedHashMap<>();
                        response_.put("session_number", result.getSessionNumber());
                        response_.put("status", "END");
                        response_.put("total_rounds", result.getTotalRounds());
                        response_.put("rounds", result.getRounds());
                        emitter.send(SseEmitter.event().name("init").data(response_));
                    } catch (JsonProcessingException e) {
                        log.error("[SSE][END] JSON 파싱 실패. key={}", key, e);
                        emitter.send(SseEmitter.event().name("init")
                                .data(Map.of("status", "END", "message", "결과 데이터 파싱 중 오류가 발생했습니다.")));
                    } catch (Exception e) {
                        // S3 파일 없음 = 종료는 됐지만 아직 집계 중
                        log.warn("[SSE][END] S3 파일 없음 또는 조회 실패. key={}", key, e);
                        emitter.send(SseEmitter.event().name("init")
                                .data(Map.of("status", "END", "message", "아직 집계 중이거나 데이터가 존재하지 않습니다.")));
                    }
                    emitter.complete();
                } catch (IOException e) {
                    emitter.completeWithError(e);
                }
                yield emitter;
            }
            case PLANNED -> {
                // 시작 전 세션: 캐싱된 상태가 있으면 사용, 없으면 WAITING 응답
                Object initData = sseService.getSessionState(contestId, session.getId());
                if (initData == null) {
                    initData = Map.of(
                            "sessionNumber", sessionNumber,
                            "status", "PLANNED",
                            "total_rounds", 0,
                            "rounds", List.of());
                }
                SseEmitter emitter = new SseEmitter(0L);
                try {
                    emitter.send(SseEmitter.event().name("init").data(initData));
                    emitter.complete();
                } catch (IOException e) {
                    emitter.completeWithError(e);
                }
                yield emitter;
            }
            default -> throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "지원하지 않는 세션 상태: " + session.getStatus());
        };
    }

    @GetMapping("/{contestId}/{sessionNumber}/session-result")
    @Operation(summary = "세션 결과 조회", description = "세션 종료 후 기록된 스위스리그 결과를 Json 형식으로 반환합니다.")
    public ResponseEntity<?> getSessionResult(@PathVariable Long contestId,
            @PathVariable int sessionNumber) {
        try {
            ContestSwissSession session = sessionRepository
                    .findTopByContestIdAndSessionNumberOrderByIdDesc(contestId, sessionNumber)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "세션을 찾을 수 없습니다."));

            if (session.getStatus() != ContestStatus.END) {
                return ResponseEntity.badRequest()
                        .body(Map.of("message", "아직 종료되지 않은 대회입니다."));
            }

            String key = s3Service.buildSessionResultKey(contestId, sessionNumber);
            String json;
            try {
                json = s3Service.readFileAsString(key);
            } catch (Exception e) {
                // S3 파일 없음 = 종료는 됐지만 아직 집계 중
                return ResponseEntity.accepted()
                        .body(Map.of("message", "아직 집계 중이거나 데이터가 존재하지 않습니다."));
            }
            try {
                SwissResultResponse response = objectMapper.readValue(json, SwissResultResponse.class);
                Map<Long, String> nicknameTagMap = getNicknameTagMap(
                        response.getFinalStandings().stream().map(SwissResultResponse.StandingDto::getUserId).toList());
                response.getFinalStandings()
                        .forEach(s -> s.setNicknameTag(nicknameTagMap.getOrDefault(s.getUserId(), "")));

                return ResponseEntity.ok(response);
            } catch (JsonProcessingException e) {
                log.error("[스위스리그] JSON 파싱 실패. key={}", key, e);
                return ResponseEntity.internalServerError()
                        .body(Map.of("message", "결과 데이터 파싱 중 오류가 발생했습니다."));
            }
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("message", e.getReason()));
        } catch (Exception e) {
            log.error("[스위스리그] 세션 결과 조회 실패. contestId={}, sessionNumber={}", contestId, sessionNumber, e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("message", "결과 조회 중 오류가 발생했습니다."));
        }
    }

    @GetMapping("/{contestId}/sessionLeaderBoard")
    @Operation(summary = "최신 세션 리더보드 조회", description = "종료된 세션 중 가장 높은 세션 번호를 가진 세션 리더보드를 조회합니다.")
    public ResponseEntity<?> getSessionLeaderBoard(@PathVariable Long contestId) {
        try {
            ContestSwissSession session = sessionRepository.findByContestId(contestId)
                    .stream()
                    .filter(s -> s.getSessionNumber() != null)
                    .filter(s -> s.getStatus() == ContestStatus.END)
                    .max(Comparator.comparing(ContestSwissSession::getSessionNumber))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "종료된 세션이 없습니다."));

            String key = s3Service.buildSessionResultKey(contestId, session.getSessionNumber());
            String json;
            try {
                json = s3Service.readFileAsString(key);
            } catch (Exception e) {
                // S3 파일 없음 = 종료는 됐지만 아직 집계 중
                return ResponseEntity.accepted()
                        .body(Map.of("message", "아직 집계 중이거나 데이터가 존재하지 않습니다."));
            }

            try {
                SwissLeaderBoardResponse response = objectMapper.readValue(json, SwissLeaderBoardResponse.class);
                Map<Long, String> nicknameTagMap = getNicknameTagMap(
                        response.getFinalStandings().stream().map(SwissLeaderBoardResponse.StandingDto::getUserId)
                                .toList());
                response.getFinalStandings()
                        .forEach(s -> s.setNicknameTag(nicknameTagMap.getOrDefault(s.getUserId(), "")));
                return ResponseEntity.ok(response);
            } catch (JsonProcessingException e) {
                log.error("[스위스리그] JSON 파싱 실패. key={}", key, e);
                return ResponseEntity.internalServerError()
                        .body(Map.of("message", "결과 데이터 파싱 중 오류가 발생했습니다."));
            }

        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("message", e.getReason()));
        } catch (Exception e) {
            log.error("[스위스리그] 세션 결과 조회 실패. contestId={}", contestId, e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("message", "결과 조회 중 오류가 발생했습니다."));
        }
    }

    @GetMapping("/{contestId}/{sessionNumber}/sessionLeaderBoard")
    @Operation(summary = "세션 리더보드 조회", description = "세션 종료 후 기록된 스위스리그 결과를 Json 형식으로 반환합니다.")
    public ResponseEntity<?> getSessionLeaderBoardbySessionNumber(@PathVariable Long contestId,
            @PathVariable int sessionNumber) {
        try {
            ContestSwissSession session = sessionRepository
                    .findTopByContestIdAndSessionNumberOrderByIdDesc(contestId, sessionNumber)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "세션을 찾을 수 없습니다."));

            if (session.getStatus() != ContestStatus.END) {
                return ResponseEntity.badRequest()
                        .body(Map.of("message", "아직 종료되지 않은 세션입니다."));
            }

            String key = s3Service.buildSessionResultKey(contestId, sessionNumber);
            String json;
            try {
                json = s3Service.readFileAsString(key);
            } catch (Exception e) {
                // S3 파일 없음 = 종료는 됐지만 아직 집계 중
                return ResponseEntity.accepted()
                        .body(Map.of("message", "아직 집계 중이거나 데이터가 존재하지 않습니다."));
            }

            try {
                SwissLeaderBoardResponse response = objectMapper.readValue(json, SwissLeaderBoardResponse.class);
                Map<Long, String> nicknameTagMap = getNicknameTagMap(
                        response.getFinalStandings().stream().map(SwissLeaderBoardResponse.StandingDto::getUserId)
                                .toList());
                response.getFinalStandings()
                        .forEach(s -> s.setNicknameTag(nicknameTagMap.getOrDefault(s.getUserId(), "")));
                return ResponseEntity.ok(response);
            } catch (JsonProcessingException e) {
                log.error("[스위스리그] JSON 파싱 실패. key={}", key, e);
                return ResponseEntity.internalServerError()
                        .body(Map.of("message", "결과 데이터 파싱 중 오류가 발생했습니다."));
            }

        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("message", e.getReason()));
        } catch (Exception e) {
            log.error("[스위스리그] 세션 결과 조회 실패. contestId={}, sessionNumber={}", contestId, sessionNumber, e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("message", "결과 조회 중 오류가 발생했습니다."));
        }
    }

    @GetMapping("/{contestId}/{sessionNumber}/{userId}")
    @Operation(summary = "세션 매치 조회", description = "최근 종료된 중간 대회의 매치를 조회합니다.")
    public ResponseEntity<?> getMiddleRanking(@PathVariable Long contestId,
            @PathVariable int sessionNumber,
            @PathVariable Long userId) {
        try {
            String key = s3Service.buildSessionResultKey(contestId, sessionNumber);
            String json;
            try {
                json = s3Service.readFileAsString(key);
            } catch (Exception e) {
                // S3 파일 없음 = 종료는 됐지만 아직 집계 중
                return ResponseEntity.accepted()
                        .body(Map.of("message", "아직 집계 중이거나 데이터가 존재하지 않습니다."));
            }
            SwissResultResponse full = objectMapper.readValue(json, SwissResultResponse.class);
            List<SwissMiddleRankResponse.MatchDto> myMatches = full.getRounds().stream()
                    .flatMap(round -> round.getMatches().stream()
                            .filter(m -> userId.equals(m.getUser1Id()) || userId.equals(m.getUser2Id()))
                            .map(m -> SwissMiddleRankResponse.MatchDto.builder()
                                    .matchId(m.getMatchId())
                                    .roundNumber(round.getRoundNumber())
                                    .user1Id(m.getUser1Id())
                                    .user2Id(m.getUser2Id())
                                    .winner(m.getWinner())
                                    .result(m.getResult())
                                    .build()))
                    .collect(Collectors.toList());

            return ResponseEntity.ok(myMatches);
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("message", e.getReason()));
        } catch (Exception e) {
            log.error("[스위스리그] 나의 세션 랭킹 조회 실패. contestId={}", contestId, e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("message", "나의 결과 조회 중 오류가 발생했습니다."));
        }
    }

    @GetMapping("/{contestId}/swiss/viewMatchLog/{matchId}")
    @Operation(summary = "스위스 대회 매치 로그 조회", description = "매치 Id를 통해 로그를 조회합니다.")
    public String getSwissMatchLog(
            @PathVariable Long contestId,
            @PathVariable Long matchId) {

        ContestSwissMatch match = swissMatchRepository.findById(matchId)
                .orElseThrow(() -> new EntityNotFoundException("Match not found: " + matchId));

        return match.getLog();
    }

    @GetMapping("/{contestId}/fullLeague/viewMatchLog/{matchId}")
    @Operation(summary = "풀리그 매치 로그 조회", description = "매치 Id를 통해 로그를 조회합니다.")
    public String getContesttMatchLog(
            @PathVariable Long contestId,
            @PathVariable Long matchId) {
        CodeBattleMatch match = matchRepository.findById(matchId)
                .orElseThrow(() -> new EntityNotFoundException("Match not found: " + matchId));
        if (!match.getContest().getId().equals(contestId)) {
            log.info("요청한 매치의 대회 ID={}와 입력된 대회 ID={}가 일치하지 않습니다.", match.getId(), contestId);
        }
        return match.getLog();
    }

    @PostMapping("/{contestId}/scheduleSwissLeague")
    @Operation(summary = "스위스 리그를 예약합니다.", description = "스케줄을 받아 스위스 세션을 예약합니다.")
    public ResponseEntity<?> createSwissSession(
            @PathVariable Long contestId,
            @RequestBody List<LocalDateTime> scheduledTimes) {

        CodeBattleContest contest = contestRepository.findById(contestId)
                .orElseThrow(() -> new EntityNotFoundException("Contest not found: " + contestId));
        List<ContestSwissSession> sessions = new ArrayList<>();
        List<LocalDateTime> sorted = scheduledTimes.stream()
                .sorted()
                .toList();
        int lastSessionNumber = sessionRepository.findByContestId(contestId)
                .stream()
                .mapToInt(ContestSwissSession::getSessionNumber)
                .max()
                .orElse(0);
        // 현재 예약된 세션 넘버 다음 세션부터 예약
        for (int i = 0; i < sorted.size(); i++) {
            ContestSwissSession session = new ContestSwissSession();
            session.setContest(contest);
            session.setScheduledAt(sorted.get(i));
            // 임시로 1부터 세션 번호를 매김
            // 자동 예약 추가
            session.setStatus(ContestStatus.PLANNED);
            session.setSessionNumber(lastSessionNumber + i + 1);
            sessions.add(session);
        }

        sessionRepository.saveAll(sessions);
        for (ContestSwissSession session : sessions) {
            contestRunService.registSwissContest(contest, session);
            log.info("[스위스 리그 예약] contestId={}, sessionId={}, 시작 시간={}", contestId, session.getId(),
                    session.getScheduledAt());
        }
        return ResponseEntity.ok(Map.of("세션 리스트 생성됨", sessions.size()));
    }

    @PostMapping("/{contestId}/{sessionNumber}/runSwissSession")
    @Operation(summary = "스위스 세션을 실행합니다. (구현중)", description = "예약된 세션을 찾아 실행하고 완료 처리합니다.")
    public ResponseEntity<String> runSwissSession(
            @PathVariable Long contestId,
            @PathVariable int sessionNumber) {
        try {
            ContestSwissSession session = sessionRepository
                    .findTopByContestIdAndSessionNumberOrderByIdDesc(contestId, sessionNumber)
                    .orElseThrow(() -> new EntityNotFoundException(
                            "세션을 찾을 수 없습니다. contestId=" + contestId + ", sessionNumber=" + sessionNumber));

            swissService.generateSwissSession(contestId, sessionNumber, session.getId());

            return ResponseEntity.ok("스위스 세션 " + sessionNumber + " 실행 완료. sessionId=" + session.getId());
        } catch (EntityNotFoundException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            log.error("[스위스 세션 실행] 예외 발생", e);
            return ResponseEntity.badRequest().body(e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    @Operation(summary = "대회 코드 유효성 검증", description = "Judge/Sample/ExampleAI 코드를 채점 서버에서 실행해 검증합니다. 결과는 SSE(event: test_result)로 수신합니다.")
    @PostMapping("/validate")
    public ResponseEntity<?> validateContestCodes(
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody ValidateContestRequest request) {
        try {
            contestService.validateContestCodes(userId, request);
            return ResponseEntity.accepted()
                    .body(Map.of("message", "검증 요청이 접수되었습니다. SSE(validate_result)로 결과를 수신하세요."));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("[검증] 검증 요청 실패", e);
            return ResponseEntity.internalServerError().body(Map.of("error", "검증 요청 중 오류 발생"));
        }
    }

    private Map<Long, String> getNicknameTagMap(List<Long> userIds) {
        return profileRepository.findByUserIdIn(userIds).stream()
                .collect(Collectors.toMap(
                        p -> p.getUser().getId(),
                        p -> p.getNickname() + "-" + String.format("%04d", p.getTag())));
    }

}
