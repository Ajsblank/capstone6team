package com.asap.server.controller;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.asap.server.dto.response.ContestParticipantResponse;
import com.asap.server.service.ContestService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.Parameters;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/contests")
@RequiredArgsConstructor
public class ParticipantController {

  private final ContestService contestService;

  @PostMapping("/{contest_id}/join")
  @Operation(summary = "대회 참가 신청")
  public ResponseEntity<String> joinContest(
      @PathVariable Long contest_id,
      @RequestParam String email) {
    contestService.joinContest(contest_id, email);
    return ResponseEntity.ok("대회 참가 신청이 완료되었습니다.");
  }

  @DeleteMapping("/{contest_id}/join")
  @Operation(summary = "대회 참가 취소")
  public ResponseEntity<String> cancelJoinContest(
      @PathVariable Long contest_id,
      @RequestParam String email) {
    contestService.cancelJoinContest(contest_id, email);
    return ResponseEntity.ok("대회 참가 취소가 완료되었습니다.");
  }

  @GetMapping("/{contest_id}/participants")
  @Operation(summary = "대회 참가자 목록 조회", description = "page, size, sort를 함께 사용해 페이징/정렬 조회합니다.")
  @Parameters({
      @Parameter(in = ParameterIn.QUERY, name = "page", description = "페이지 번호 (0부터 시작)", schema = @Schema(type = "integer", defaultValue = "0", example = "0")),
      @Parameter(in = ParameterIn.QUERY, name = "size", description = "페이지 크기", schema = @Schema(type = "integer", defaultValue = "20", example = "20")),
      @Parameter(in = ParameterIn.QUERY, name = "sort", description = "정렬 기준 (사용법: 컬럼명,asc|desc)", array = @ArraySchema(schema = @Schema(type = "string", example = "id,desc")))
  })
  public ResponseEntity<Page<ContestParticipantResponse>> getContestParticipants(
      @PathVariable Long contest_id,
      @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.DESC) Pageable pageable) {
    return ResponseEntity.ok(contestService.getContestParticipants(contest_id, pageable));
  }
}
