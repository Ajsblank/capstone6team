package com.asap.server.dto.response;

import java.util.List;

import com.asap.server.global.type.ContestStatus;
import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@AllArgsConstructor
@NoArgsConstructor
public class SwissResultResponse {
  @JsonProperty("session_number")
  private int sessionNumber;
  @JsonProperty("total_participants")
  private int totalParticipants;
  @JsonProperty("total_rounds")
  private int totalRounds;
  @JsonProperty("final_standings")
  private List<StandingDto> finalStandings;
  @JsonProperty("rounds")
  private List<RoundDto> rounds;

  @Getter
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class RoundDto {
    @JsonProperty("round_number")
    private int roundNumber;

    private ContestStatus status;

    private List<MatchDto> matches;
  }

  @Getter
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class MatchDto {
    @JsonProperty("match_id")
    private Long matchId;

    @JsonProperty("user1_id")
    private Long user1Id;

    @JsonProperty("user2_id")
    private Long user2Id;

    private Integer winner;

    private String result;
  }

  @Getter
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class StandingDto {
    @JsonProperty("user_id")
    private Long userId;

    private int wins;
    private int draws;
    private int losses;
    private double points;
    private int rank;

    private List<Long> opponents;

    @JsonProperty("match_ids")
    private List<Long> matchIds;
  }
}
