package com.asap.server.dto.response;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@AllArgsConstructor
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class FinalResultResponse {
  private int total_participants;

  @JsonProperty("final-standings")
  private List<StandingDto> finalStandings;

  @Getter
  @Setter
  @NoArgsConstructor
  @AllArgsConstructor
  public static class StandingDto {
    @JsonProperty("user_id")
    private Long userId;
    @JsonProperty("nickname_tag")
    private String nicknameTag;
    private int wins;
    private int draws;
    private int losses;
    private int rank;
    private double points;
    private List<Long> match_ids;
  }
}
