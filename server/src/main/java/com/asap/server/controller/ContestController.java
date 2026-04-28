package com.asap.server.controller;

import java.net.URI;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleContest.ContestStatus;
import com.asap.server.dto.request.ContestResourceRequest;
import com.asap.server.dto.request.CreateContestRequest;
import com.asap.server.dto.request.UpdateContestRequest;
import com.asap.server.dto.response.ContestDetailResponse;
import com.asap.server.dto.response.ContestListResponse;
import com.asap.server.dto.response.ContestResponse;
import com.asap.server.service.ContestService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.Parameters;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/contests")
@RequiredArgsConstructor
public class ContestController {

    private final ContestService contestService;

    @PostMapping("/create")
    public ResponseEntity<ContestResponse> createContest(@Valid @RequestBody CreateContestRequest request) {
        ContestResponse response = contestService.createContest(request);
        return ResponseEntity.created(URI.create("/api/contests/" + response.getId())).body(response);
    }

    @PostMapping("/{contest_id}/resources")
    public ResponseEntity<ContestResponse> createContestResource(@PathVariable Long contest_id,
            @Valid @RequestBody ContestResourceRequest request) {
        ContestResponse response = contestService.createContestResource(contest_id, request);
        return ResponseEntity.ok(response);
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

    @GetMapping("/{contest_id}")
    public ResponseEntity<ContestResponse> getContestDetail(@PathVariable Long contest_id) {
        CodeBattleContest contest = contestService.getContestById(contest_id);
        return ResponseEntity.ok(ContestResponse.from(contest));
    }

    @GetMapping("/{contest_id}/admin")
    public ResponseEntity<ContestDetailResponse> getContestDetailAdmin(@PathVariable Long contest_id) {
        CodeBattleContest contest = contestService.getContestById(contest_id);
        return ResponseEntity.ok(ContestDetailResponse.from(contest));
    }

    @PatchMapping("/{contest_id}")
    public ResponseEntity<ContestDetailResponse> updateContest(
            @PathVariable Long contest_id,
            @RequestBody UpdateContestRequest request) {
        return ResponseEntity.ok(contestService.updateContest(contest_id, request));
    }

}
