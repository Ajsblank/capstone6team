package com.asap.server.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CodeSubmitRequest {
    @NotBlank
    private String user_id;
    @NotBlank
    private String problem_id;
    @NotBlank
    private String language;
    @NotBlank
    private String source_code;
}