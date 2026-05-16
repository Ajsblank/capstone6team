package com.asap.server.dto.request;

import com.asap.server.global.type.Language;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Schema(description = "대회 검수(코드 검증) 요청")
public class ContestVerifierRequest {

  @NotBlank
  @Schema(description = "첫 번째 코드 (소스코드 문자열)", example = "#include <iostream>\nint main(){return 0;}")
  private String code1;

  @NotNull
  @Schema(description = "code1의 언어", allowableValues = {
      "PYTHON", "CPP", "JAVA" }, example = "CPP")
  private Language language1;

  @NotBlank
  @Schema(description = "두 번째 코드 (소스코드 문자열)", example = "#include <iostream>\\nint main(){return 0;}")
  private String code2;

  @NotNull
  @Schema(description = "code2의 언어", allowableValues = {
      "PYTHON", "CPP", "JAVA" }, example = "CPP")
  private Language language2;
}
