package com.asap.server.controller;

import java.util.ArrayList;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.asap.server.domain.Users;
import com.asap.server.dto.request.CodeSubmitRequest;
import com.asap.server.dto.request.TestSubmitRequest;
import com.asap.server.dto.response.ContestParticipantResponse;
import com.asap.server.repository.usersRepository;
import com.asap.server.service.ContestService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.Parameters;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/api/contests")
@RequiredArgsConstructor
@Slf4j
public class ParticipantController {

  private final ContestService contestService;
  private final usersRepository userRepository;
  private final CodeController codeController;

  @PostMapping("/{contestId}/join")
  @Operation(summary = "대회 참가 신청")
  public ResponseEntity<String> joinContest(
      @PathVariable Long contestId,
      @RequestParam String email) {
    contestService.joinContest(contestId, email);
    return ResponseEntity.ok("대회 참가 신청이 완료되었습니다.");
  }

  @PostMapping("/{contestId}/test/join")
  @Operation(summary = "테스트 참가자들 대회 참가 신청", description = "test_01@test.com 형식의 유저를 참가시킵니다. 최대 50")
  public ResponseEntity<String> multipleJoinContest(
      @PathVariable Long contestId,
      @RequestParam int number) {
    if (number > 50 || number < 1) {
      log.info("잘못된 범위의 숫자입니다.");
      return ResponseEntity.badRequest().body("1~50 사이의 숫자를 입력해 주세요.");
    }
    List<String> emails = new ArrayList<>();
    for (int i = 0; i < number; i++) {
      emails.add(String.format("test_%02d@test.com", i + 1));
    }
    for (String email : emails)
      contestService.joinContest(contestId, email);
    return ResponseEntity.ok("대회 참가 신청이 완료되었습니다.");
  }

  @PostMapping("/{contestId}/test/submit")
  @Operation(summary = "테스트 코드 자동 제출", description = "test_01@test.com 형식의 유저들이 자동으로 코드를 제출합니다.")
  public ResponseEntity<String> multipleSubmitContest(
      @PathVariable Long contestId,
      @RequestBody TestSubmitRequest req) {
    int from = req.getFrom();
    int to = req.getTo();
    if (from < 1 || to > 50 || from > to) {
      log.info("잘못된 범위의 숫자입니다.");
      return ResponseEntity.badRequest().body("1~50 사이의 숫자를 입력해주세요. (from <= to)");
    }

    for (int i = from; i <= to; i++) {
      try {
        Users user = userRepository.findByEmail(String.format("test_%02d@test.com", i))
            .orElse(null);
        if (user == null) {
          log.info("test_%02d 유저가 존재하지 않아 건너뜁니다.".formatted(i));
          continue;
        }

        CodeSubmitRequest request = new CodeSubmitRequest();
        request.setUserId(String.valueOf(user.getId()));
        request.setProblemId(String.valueOf(contestId));
        request.setLanguage(req.getLanguage());
        request.setSourceCode(req.getSourceCode());

        codeController.submitBattle(request);
        log.info("test_{} 제출 완료", String.format("%02d", i));
      } catch (Exception e) {
        log.warn("test_{} 제출 실패: {}", String.format("%02d", i), e.getMessage());
      }
    }

    return ResponseEntity.ok("%d~%d번 유저 코드 제출 완료".formatted(from, to));
  }

  @DeleteMapping("/{contestId}/join")
  @Operation(summary = "대회 참가 취소")
  public ResponseEntity<String> cancelJoinContest(
      @PathVariable Long contestId,
      @RequestParam String email) {
    contestService.cancelJoinContest(contestId, email);
    return ResponseEntity.ok("대회 참가 취소가 완료되었습니다.");
  }

  @GetMapping("/{contestId}/participants")
  @Operation(summary = "대회 참가자 목록 조회", description = "page, size, sort를 함께 사용해 페이징/정렬 조회합니다.")
  @Parameters({
      @Parameter(in = ParameterIn.QUERY, name = "page", description = "페이지 번호 (0부터 시작)", schema = @Schema(type = "integer", defaultValue = "0", example = "0")),
      @Parameter(in = ParameterIn.QUERY, name = "size", description = "페이지 크기", schema = @Schema(type = "integer", defaultValue = "20", example = "20")),
      @Parameter(in = ParameterIn.QUERY, name = "sort", description = "정렬 기준 (사용법: 컬럼명,asc|desc)", array = @ArraySchema(schema = @Schema(type = "string", example = "id,desc")))
  })
  public ResponseEntity<Page<ContestParticipantResponse>> getContestParticipants(
      @PathVariable Long contestId,
      @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.DESC) Pageable pageable) {
    return ResponseEntity.ok(contestService.getContestParticipants(contestId, pageable));
  }
}
