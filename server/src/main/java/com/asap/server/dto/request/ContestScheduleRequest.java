package com.asap.server.dto.request;

import java.time.LocalDateTime;

import com.asap.server.global.json.FlexibleMinuteLocalDateTimeDeserializer;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Schema(description = "중간 대회 일정")
public class ContestScheduleRequest {
  @NotNull(message = "시작 시간은 필수입니다.")
  @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
  @JsonAlias("start_date")
  @JsonDeserialize(using = FlexibleMinuteLocalDateTimeDeserializer.class)
  @Schema(description = "중간 대회 시작 시각", type = "string", format = "date-time", example = "2026-05-26 18:20")
  private LocalDateTime startDate;
}
