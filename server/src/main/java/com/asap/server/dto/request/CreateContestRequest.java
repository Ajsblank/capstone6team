package com.asap.server.dto.request;

import java.time.LocalDateTime;

import com.asap.server.domain.CodeBattleContest.ContestStatus;
import com.asap.server.global.json.FlexibleMinuteLocalDateTimeDeserializer;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Schema(description = "대회 생성 요청")
public class CreateContestRequest {

  @NotBlank(message = "제목은 필수입니다.")
  private String title;

  @NotBlank(message = "설명은 필수입니다.")
  private String description;

  @NotNull(message = "인증 여부는 필수입니다.")
  private Boolean certification;

  @NotNull(message = "시간 제한은 필수입니다.")
  @Positive(message = "시간 제한은 1 이상이어야 합니다.")
  private Integer timeLimitSec;

  @NotNull(message = "메모리 제한은 필수입니다.")
  @Positive(message = "메모리 제한은 1 이상이어야 합니다.")
  private Integer memoryLimitMb;

  @NotBlank(message = "judgeCode는 필수입니다.")
  private String judgeCode;

  @NotBlank(message = "ExampleCode는 필수입니다.")
  private String exampleCode;

  @NotBlank(message = "시각화 리소스")
  private String visualizationHtml;

  @NotBlank(message = "혼자하기")
  private String soloPlayHtml;

  @NotNull(message = "상태는 필수입니다.")
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

  @NotNull(message = "최대 참가자 수는 필수입니다.")
  @Positive(message = "최대 참가자 수는 1 이상이어야 합니다.")
  private Integer maxParticipants;
}
