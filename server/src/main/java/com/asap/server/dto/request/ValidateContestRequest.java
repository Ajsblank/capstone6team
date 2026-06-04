package com.asap.server.dto.request;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Schema(description = "대회 코드 유효성 검증 요청")
public class ValidateContestRequest {

    @NotBlank(message = "judgeCode는 필수입니다.")
    @Schema(description = "Judge 코드 (언어는 CPP 고정)")
    private String judgeCode;

    @Valid
    @NotEmpty(message = "sampleCodes는 최소 1개 이상 필요합니다.")
    @Schema(description = "스켈레톤(샘플) 코드 목록")
    private List<SampleCodeRequest> sampleCodes;

    @Valid
    @NotEmpty(message = "exampleAiCodes는 최소 1개 이상 필요합니다.")
    @Schema(description = "예제 AI 코드 목록")
    private List<ExampleAiRequest> exampleAiCodes;
}
