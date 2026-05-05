package com.asap.server.dto.request;

import java.time.LocalDateTime;

import com.asap.server.domain.CodeBattleContest.ContestStatus;
import com.asap.server.global.json.FlexibleMinuteLocalDateTimeDeserializer;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Schema(description = "대회 수정 요청")
public class UpdateContestRequest {

  private String title;
  private String description;
  private Boolean certification;
  private Integer timeLimitSec;
  private Integer memoryLimitMb;
  private String judgeCode;
  private String exampleCode;
  private String visualizationHtml;
  private String soloPlayHtml;
  @Schema(description = "대회 상태 (TEST, PLANNED, RUNNING, PAUSED, END)", example = "PLANNED")
  private ContestStatus status;

  @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
  @JsonAlias("start_date")
  @JsonDeserialize(using = FlexibleMinuteLocalDateTimeDeserializer.class)
  @Schema(description = "대회 시작 시각. 권장 형식: yyyy-MM-dd HH:mm (예: 2026-04-26 18:20). TEST 상태에서는 null로 저장됩니다.", type = "string", format = "date-time", example = "2026-04-26 18:20")
  private LocalDateTime startDate;

  @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
  @JsonAlias("end_date")
  @JsonDeserialize(using = FlexibleMinuteLocalDateTimeDeserializer.class)
  @Schema(description = "대회 종료 시각. 권장 형식: yyyy-MM-dd HH:mm (예: 2026-04-26 20:20). TEST 상태에서는 null로 저장됩니다.", type = "string", format = "date-time", example = "2026-04-26 20:20")
  private LocalDateTime endDate;
  private Integer maxParticipants;
}
