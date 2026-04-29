package com.asap.server.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Schema(description = "대회 리소스 등록 요청")
public class ContestResourceRequest {

  @Schema(description = "visualization_html 입력")
  @JsonAlias({ "visualizationHtml" })
  private String visualization_html;

  @Schema(description = "solo_play_html은 입력")
  @JsonAlias({ "soloPlayHtml" })
  private String solo_play_html;

}
