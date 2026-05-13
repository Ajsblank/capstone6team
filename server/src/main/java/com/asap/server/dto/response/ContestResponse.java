package com.asap.server.dto.response;

import java.time.LocalDateTime;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleContest.ContestStatus;
import com.fasterxml.jackson.annotation.JsonFormat;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ContestResponse {

  private Long id;
  private String title;
  private String description;
  private Boolean certification;
  private Integer timeLimitSec;
  private Integer memoryLimitMb;
  // 보안 조치 private String judgeCode;
  private String exampleCode;
  private ContestStatus status;

  private String visualizationHtml;
  private String soloPlayHtml;

  @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
  private LocalDateTime startDate;

  @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
  private LocalDateTime endDate;

  private Integer maxParticipants;
  private LocalDateTime createdAt;

  public static ContestResponse from(CodeBattleContest contest) {
    return ContestResponse.builder()
        .id(contest.getId())
        .title(contest.getTitle())
        .description(contest.getDescription())
        .certification(contest.getCertification())
        .timeLimitSec(contest.getTimeLimitSec())
        .memoryLimitMb(contest.getMemoryLimitMB())
        // .judgeCode(contest.getJudgeCode())
        .exampleCode(contest.getExampleCode())
        .status(contest.getStatus())
        .startDate(contest.getStartDate())
        .endDate(contest.getEndDate())
        .maxParticipants(contest.getMaxParticipants())
        .createdAt(contest.getCreatedAt())
        .visualizationHtml(contest.getVisualizationHtml())
        .soloPlayHtml(contest.getSoloPlayHtml())
        .build();
  }
}
