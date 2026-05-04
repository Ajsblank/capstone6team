package com.asap.server.dto.request;

import com.asap.server.global.type.Language;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CodeSubmitRequest {
    @NotBlank
    private String userId;
    @NotBlank
    private String problemId;
    @NotNull
    private Language language;
    @NotBlank
    private String sourceCode;
}