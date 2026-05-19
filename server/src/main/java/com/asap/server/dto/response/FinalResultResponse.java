package com.asap.server.dto.response;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@AllArgsConstructor
@NoArgsConstructor
public class FinalResultResponse {
  private int total_participants;

  @JsonProperty("final-standings")
  private List<StandingDto> finalStandings;

  @Getter
  @NoArgsConstructor
  @AllArgsConstructor
  public static class StandingDto {
    private Long user_id;
    private int wins;
    private int draws;
    private int losses;
    private int rank;
    private double points;
    private List<Long> match_ids;
  }
}
