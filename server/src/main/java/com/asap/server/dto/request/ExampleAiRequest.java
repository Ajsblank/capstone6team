package com.asap.server.dto.request;

import com.asap.server.global.type.Language;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ExampleAiRequest {
  @NotBlank(message = "code는 필수입니다.")
  @Schema(description = "예제 AI 코드 내용", example = "int main() { return 0; }")
  private String code;

  @Schema(description = "예제 AI 코드 설명", example = "기본 예제")
  private String description;

  @Schema(description = "언어", example = "CPP")
  private Language language = Language.CPP;
}
