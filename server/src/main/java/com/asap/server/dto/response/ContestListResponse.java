package com.asap.server.dto.response;

import java.time.LocalDateTime;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleContest.ContestStatus;
import com.fasterxml.jackson.annotation.JsonFormat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class ContestListResponse {

  private Long id;
  private String title;
  private ContestStatus status;

  @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
  private LocalDateTime start_date;

  @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
  private LocalDateTime end_date;

  private Integer max_participants;

  public static ContestListResponse from(CodeBattleContest contest) {
    return ContestListResponse.builder()
        .id(contest.getId())
        .title(contest.getTitle())
        .status(contest.getStatus())
        .start_date(contest.getStart_date())
        .end_date(contest.getEnd_date())
        .max_participants(contest.getMax_participants())
        .build();
  }
}
