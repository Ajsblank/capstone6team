package com.asap.server.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.asap.server.dto.request.CodeBattleSubmitRequest;
import com.asap.server.dto.response.CodeSubmitResponse;
import com.asap.server.service.CodeBattleSubmissionService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Encoding;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/codebattle")
@RequiredArgsConstructor
public class CodeBattleController {

  private final CodeBattleSubmissionService codeBattleSubmissionService;

  @PostMapping(value = "/submissions", consumes = "multipart/form-data")
  @Operation(description = "코드 배틀 제출 전용 API. request 파트(userId, contestId, language)와 file 파트(소스코드 파일)를 multipart/form-data로 전송합니다.")
  @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true, content = @Content(mediaType = "multipart/form-data", encoding = {
      @Encoding(name = "request", contentType = "application/json"),
      @Encoding(name = "file", contentType = "text/plain")
  }))
  public ResponseEntity<CodeSubmitResponse> submitCodeBattle(
      @Valid @RequestPart("request") CodeBattleSubmitRequest request,
      @RequestPart("file") MultipartFile file) {
    try {
      var submission = codeBattleSubmissionService.submitAndQueuePullLeague(
          request.getContestId(),
          request.getUserId(),
          request.getLanguage(),
          file);

      return ResponseEntity.ok(new CodeSubmitResponse(true, "코드 배틀 제출 완료 (ID: " + submission.getId() + ")"));
    } catch (Exception e) {
      return ResponseEntity.badRequest().body(new CodeSubmitResponse(false, e.getMessage()));
    }
  }
}