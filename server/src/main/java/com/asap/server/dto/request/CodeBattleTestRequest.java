package com.asap.server.dto.request;

import com.asap.server.global.type.Language;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CodeBattleTestRequest {
    @NotBlank
    private String userId;
    @NotBlank
    private String problemId;
    @NotBlank
    private String sourceCode1;
    @NotBlank
    private String sourceCode2;
}