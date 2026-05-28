package com.asap.server.dto.response;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonPropertyOrder({ "session_number", "total_participants", "total_rounds", "my_standing", "my_matches" })
public class SwissMiddleRankResponse {
  @JsonProperty("session_number")
  private int sessionNumber;
  @JsonProperty("total_participants")
  private int totalParticipants;
  @JsonProperty("total_rounds")
  private int totalRounds;
  @JsonProperty("my_standing")
  private StandingDto myStanding;
  @JsonProperty("my_matches")
  private List<MatchDto> myMatches;

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
    private int points;
    private int rank;
  }

  @Getter
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class MatchDto {
    @JsonProperty("match_id")
    private Long matchId;
    @JsonProperty("round_number")
    private int roundNumber;
    @JsonProperty("user1_id")
    private Long user1Id;
    @JsonProperty("user2_id")
    private Long user2Id;
    private Integer winner;
    private String result;
  }
}
