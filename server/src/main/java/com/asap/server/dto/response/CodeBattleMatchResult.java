package com.asap.server.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CodeBattleMatchResult {
    private Long matchId;
    private String winner;
    private String log;
    private Integer aiOrder;
}