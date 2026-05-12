package com.asap.server.dto.request;

import com.asap.server.global.type.Language;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CodeBattleSubmitRequest {

  @NotNull
  private Long userId;

  @NotNull
  private Long contestId;

  @NotNull
  private Language language;

  @NotBlank
  private String sourceCode;
}