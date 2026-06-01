package com.asap.server.dto.request;

import com.asap.server.global.type.Language;

import jakarta.persistence.Column;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CodeBattleTestRequest {
    @NotBlank
    private String userId;
    @NotBlank
    private String problemId;
    @Column(columnDefinition = "language1", nullable = false)
    private Language language1;
    @Column(columnDefinition = "language2", nullable = false)
    private Language language2;
    @NotBlank
    private String sourceCode1;
    @NotBlank
    private String sourceCode2;
}