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
  private Integer timeLimitSec;
  private Integer memoryLimitMb;
  private String judgeCode;
  private String exampleCode;
  private ContestStatus status;

  @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
  private LocalDateTime startDate;

  @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
  private LocalDateTime endDate;

  private Integer maxParticipants;
  private LocalDateTime createdAt;

  public static ContestDetailResponse from(CodeBattleContest contest) {
    return ContestDetailResponse.builder()
        .id(contest.getId())
        .title(contest.getTitle())
        .description(contest.getDescription())
        .certification(contest.getCertification())
        .timeLimitSec(contest.getTimeLimitSec())
        .memoryLimitMb(contest.getMemoryLimitMB())
        .judgeCode(contest.getJudgeCode())
        .exampleCode(contest.getExampleCode())
        .status(contest.getStatus())
        .startDate(contest.getStartDate())
        .endDate(contest.getEndDate())
        .maxParticipants(contest.getMaxParticipants())
        .createdAt(contest.getCreatedAt())
        .build();
  }
}
