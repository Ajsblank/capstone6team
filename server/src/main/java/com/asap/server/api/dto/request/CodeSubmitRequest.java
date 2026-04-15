package com.asap.server.api.dto.request;
import jakarta.validation.constraints.NotBlank;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CodeSubmitRequest {
    @NotBlank
    private String userId;
    @NotBlank
    private String problemId;
    @NotBlank
    private String language;
    @NotBlank
    private String sourceCode;
}
