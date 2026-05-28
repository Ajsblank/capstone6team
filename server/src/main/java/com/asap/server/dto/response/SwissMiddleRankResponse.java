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
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonPropertyOrder({ "session_number", "total_participants", "total_rounds", "final_standings" })
public class SwissMiddleRankResponse {
  @JsonProperty("session_number")
  private int sessionNumber;
  @JsonProperty("total_participants")
  private int totalParticipants;
  @JsonProperty("total_rounds")
  private int totalRounds;
  @JsonProperty("final_standings")
  private List<StandingDto> finalStandings;

  @Getter
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  @JsonIgnoreProperties(ignoreUnknown = true)

  public static class StandingDto {
    @JsonProperty("user_id")
    private Long userId;
    private int wins;
    private int draws;
    private int losses;
    private int points;
    private int rank;
  }
}
