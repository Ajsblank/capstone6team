package com.asap.server.dto.response;

import com.asap.server.domain.CodeBattleMatch;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class CodeBattleAiMatchResult {
    private Long aiId;     // AI 번호 (1번)
    private String status; // 승패 (WIN, LOSS, DRAW)
    private String log;    // 대결 로그

    public static CodeBattleAiMatchResult from(CodeBattleMatch match, Long userId) {
        if (match == null) return null;

        String status = "DRAW";
        if (match.getWinner() != null) {
            status = match.getWinner().getId().equals(userId) ? "WIN" : "LOSS";
        }

        return CodeBattleAiMatchResult.builder()
                .aiId(1L)
                .status(status)
                .log(match.getLog())
                .build();
    }
}