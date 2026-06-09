package com.asap.server.dto.response;

import java.time.LocalDateTime;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.global.type.ContestStatus;
import com.asap.server.repository.CodeBattleContestRepository.ContestListProjection;
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
  private LocalDateTime startDate;

  @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
  private LocalDateTime endDate;

  private Integer maxParticipants;

  public static ContestListResponse from(CodeBattleContest contest) {
    return ContestListResponse.builder()
        .id(contest.getId())
        .title(contest.getTitle())
        .status(contest.getStatus())
        .startDate(contest.getStartDate())
        .endDate(contest.getEndDate())
        .maxParticipants(contest.getMaxParticipants())
        .build();
  }

  public static ContestListResponse from(ContestListProjection p) {
    return ContestListResponse.builder()
        .id(p.getId())
        .title(p.getTitle())
        .status(p.getStatus())
        .startDate(p.getStartDate())
        .endDate(p.getEndDate())
        .maxParticipants(p.getMaxParticipants())
        .build();
  }
}
