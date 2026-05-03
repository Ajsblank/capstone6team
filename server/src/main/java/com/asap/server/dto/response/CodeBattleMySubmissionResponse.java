package com.asap.server.dto.response;

import com.asap.server.domain.CodeBattleSubmission;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
@AllArgsConstructor
public class CodeBattleMySubmissionResponse {
    private Long submissionId;      // 제출 번호
    private LocalDateTime createdAt; // 제출 시각
    private CodeBattleAiMatchResult result;   // 결과(AI번호, 승패, 로그)

    public static CodeBattleMySubmissionResponse of(CodeBattleSubmission submission, CodeBattleAiMatchResult result) {
        return CodeBattleMySubmissionResponse.builder()
                .submissionId(submission.getId())
                .createdAt(submission.getCreated_at())
                .result(result)
                .build();
    }
}