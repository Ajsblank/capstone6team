package com.asap.server.dto.response;

import java.time.LocalDateTime;

import com.asap.server.domain.CodeBattleSubmission;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class SubmissionCodeResponse {
    private Long submissionId;
    private String language;
    private String code;
    private String result;
    private LocalDateTime createdAt;

    public static SubmissionCodeResponse of(CodeBattleSubmission submission, String code) {
        return SubmissionCodeResponse.builder()
                .submissionId(submission.getId())
                .language(submission.getLanguage().name())
                .code(code)
                .result(submission.getResult())
                .createdAt(submission.getCreatedAt())
                .build();
    }
}
