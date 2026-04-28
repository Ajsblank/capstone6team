package com.asap.server.dto.request;

import com.asap.server.domain.CodeLanguage;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CodeSubmitRequest {
    @NotBlank
    private String user_id;
    @NotBlank
    private String problem_id;
    @NotNull
    private CodeLanguage language;
    @NotBlank
    private String source_code;
}
