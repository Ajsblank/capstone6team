package com.asap.server.dto.response;

import java.time.LocalDateTime;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleContest.ContestStatus;
import com.fasterxml.jackson.annotation.JsonFormat;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ContestDetailResponse {

  private Long id;
  private String title;
  private String description;
  private Boolean certification;
  private Integer time_limit_sec;
  private Integer memory_limit_mb;
  private String judge_code;
  private String example_code;
  private ContestStatus status;

  @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
  private LocalDateTime start_date;

  @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
  private LocalDateTime end_date;

  private Integer max_participants;
  private LocalDateTime created_at;

  public static ContestDetailResponse from(CodeBattleContest contest) {
    return ContestDetailResponse.builder()
        .id(contest.getId())
        .title(contest.getTitle())
        .description(contest.getDescription())
        .certification(contest.getCertification())
        .time_limit_sec(contest.getTime_limit_sec())
        .memory_limit_mb(contest.getMemory_limit_mb())
        .judge_code(contest.getJudge_code())
        .example_code(contest.getExample_code())
        .status(contest.getStatus())
        .start_date(contest.getStart_date())
        .end_date(contest.getEnd_date())
        .max_participants(contest.getMax_participants())
        .created_at(contest.getCreated_at())
        .build();
  }
}
