package com.asap.server.dto.request;

import java.time.LocalDateTime;

import com.asap.server.domain.CodeBattleContest.ContestStatus;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateContestStatusRequest {

    @NotNull(message = "상태는 필수입니다.")
    private ContestStatus status;

    private LocalDateTime start_date;
    private LocalDateTime end_date;
}
