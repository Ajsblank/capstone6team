package com.asap.server.dto.request;

import com.asap.server.global.type.Language;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SampleCodeRequest {
  @NotBlank(message = "sampleCode는 필수입니다.")
  @Schema(description = "샘플 코드 내용", example = "int main() { return 0; }")
  private String code;

  @NotNull(message = "language는 필수입니다.")
  @Schema(description = "언어", example = "CPP")
  private Language language;
}
