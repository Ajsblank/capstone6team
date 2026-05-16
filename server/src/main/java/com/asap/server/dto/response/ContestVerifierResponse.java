package com.asap.server.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
@Schema(description = "대회 검수 응답")
public class ContestVerifierResponse {

    @Schema(description = "검증 결과 메시지", example = "검수 요청이 접수되었습니다.")
    private String message;

    @Schema(description = "검증 로그 (필요 시)", example = "")
    private String log;

    public ContestVerifierResponse(String message) {
        this.message = message;
        this.log = "";
    }
}
