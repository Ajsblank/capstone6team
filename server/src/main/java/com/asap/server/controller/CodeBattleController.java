package com.asap.server.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.asap.server.dto.request.CodeBattleSubmitRequest;
import com.asap.server.dto.response.CodeSubmitResponse;
import com.asap.server.service.CodeBattleSubmissionService;

import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/codebattle")
@RequiredArgsConstructor
public class CodeBattleController {

  private final CodeBattleSubmissionService codeBattleSubmissionService;

  @PostMapping("/submissions")
  @Operation(description = "코드 배틀 제출 전용 API, language는 enum(CPP,PYTHON,JAVA,C) 타입입니다.")
  public ResponseEntity<CodeSubmitResponse> submitCodeBattle(@Valid @RequestBody CodeBattleSubmitRequest request) {
    try {
      var submission = codeBattleSubmissionService.submitAndQueuePullLeague(
          request.getContestId(),
          request.getUserId(),
          request.getLanguage(),
          request.getSourceCode());

      return ResponseEntity.ok(new CodeSubmitResponse(true, "코드 배틀 제출 완료 (ID: " + submission.getId() + ")"));
    } catch (Exception e) {
      return ResponseEntity.badRequest().body(new CodeSubmitResponse(false, e.getMessage()));
    }
  }
}