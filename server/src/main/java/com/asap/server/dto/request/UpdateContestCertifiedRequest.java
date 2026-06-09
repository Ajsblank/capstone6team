package com.asap.server.dto.request;

import java.time.LocalDateTime;
import java.util.List;

import com.asap.server.global.json.FlexibleMinuteLocalDateTimeDeserializer;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Schema(description = "대회 수정 요청(PATCH). 모든 필드는 선택이며, 요청에 포함된 필드만 수정됩니다.")
public class UpdateContestCertifiedRequest {

  private String title;
  private String description;
  private Integer timeLimitSec;
  private Integer memoryLimitMb;

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

  @NotEmpty(message = "검수자 이메일 리스트는 필수입니다. (최소 1명)")
  @Schema(description = "검수자 이메일 리스트 (필수, 최소 1명)", example = "[\"reviewer1@example.com\", \"reviewer2@example.com\"]")
  private List<String> reviewerEmails;
}
