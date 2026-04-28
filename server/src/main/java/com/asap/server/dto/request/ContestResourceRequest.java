package com.asap.server.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Schema(description = "대회 리소스 등록 요청")
public class ContestResourceRequest {

  @NotBlank(message = "visualization_html은 필수입니다.")
  @JsonAlias({ "visualizationHtml" })
  private String visualization_html;

  @NotBlank(message = "solo_play_html은 필수입니다.")
  @JsonAlias({ "soloPlayHtml" })
  private String solo_play_html;

}
