package com.asap.server.dto.response;

import java.time.LocalDateTime;
import java.util.List;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.dto.request.SampleCodeRequest;
import com.asap.server.global.type.ContestStatus;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ContestResponse {

  private Long id;
  @JsonProperty("creator_id")
  private Long creatorId;
  private String title;
  private String description;
  private Boolean certification;
  private Integer timeLimitSec;
  private Integer memoryLimitMb;
  // 보안 조치 private String judgeCode;
  private ContestStatus status;

  private String visualizationHtml;
  private String soloPlayHtml;

  @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
  private LocalDateTime startDate;

  @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
  private LocalDateTime endDate;

  private Integer maxParticipants;
  private LocalDateTime createdAt;
  private List<SampleCodeRequest> sampleCodes;
  private List<String> exampleAiCodes;

  public static ContestResponse from(CodeBattleContest contest) {
    return from(contest, List.of(), List.of());
  }

  public static ContestResponse from(CodeBattleContest contest, List<String> exampleAiCodes,
      List<SampleCodeRequest> sampleCodes) {
    return ContestResponse.builder()
        .id(contest.getId())
        .creatorId(contest.getCreator() != null ? contest.getCreator().getId() : null)
        .title(contest.getTitle())
        .description(contest.getDescription())
        .certification(contest.getCertification())
        .timeLimitSec(contest.getTimeLimitSec())
        .memoryLimitMb(contest.getMemoryLimitMB())
        // .judgeCode(contest.getJudgeCode())
        .status(contest.getStatus())
        .startDate(contest.getStartDate())
        .endDate(contest.getEndDate())
        .maxParticipants(contest.getMaxParticipants())
        .createdAt(contest.getCreatedAt())
        .visualizationHtml(contest.getVisualizationHtml())
        .soloPlayHtml(contest.getSoloPlayHtml())
        .sampleCodes(sampleCodes)
        .exampleAiCodes(exampleAiCodes)
        .build();
  }
}
