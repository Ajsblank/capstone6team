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
import org.springframework.web.bind.annotation.RestController;

import com.asap.server.domain.CodeBattleContest;
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

    @GetMapping("/list")
    @Operation(summary = "대회 목록 조회", description = "page, size, sort를 함께 사용해 페이징/정렬 조회합니다.")
    @Parameters({
            @Parameter(in = ParameterIn.QUERY, name = "page", description = "페이지 번호 (0부터 시작)", schema = @Schema(type = "integer", defaultValue = "0", example = "0")),
            @Parameter(in = ParameterIn.QUERY, name = "size", description = "페이지 크기", schema = @Schema(type = "integer", defaultValue = "20", example = "20")),
            @Parameter(in = ParameterIn.QUERY, name = "sort", description = "정렬 기준 (사용법: 컬럼명,asc|desc)", array = @ArraySchema(schema = @Schema(type = "string", example = "id,desc")))
    })
    public ResponseEntity<Page<ContestListResponse>> getContestList(
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.DESC) Pageable pageable) {
        Page<ContestListResponse> responses = contestService.getContestPage(pageable);
        return ResponseEntity.ok(responses);
    }

    @GetMapping("/{contestId}")
    public ResponseEntity<ContestDetailResponse> getContestDetail(@PathVariable Long contestId) {
        CodeBattleContest contest = contestService.getContestById(contestId);
        return ResponseEntity.ok(ContestDetailResponse.from(contest));
    }

    @PatchMapping("/{contestId}")
    public ResponseEntity<ContestResponse> updateContest(
            @PathVariable Long contestId,
            @RequestBody UpdateContestRequest request) {
        return ResponseEntity.ok(contestService.updateContest(contestId, request));
    }

}
