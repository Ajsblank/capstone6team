package com.asap.server.dto.request;

import java.time.LocalDateTime;

import com.asap.server.global.json.FlexibleMinuteLocalDateTimeDeserializer;
import com.asap.server.global.type.ContestStatus;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Schema(description = "대회 생성 요청")
@JsonPropertyOrder({
    "title",
    "description",
    "certification",
    "timeLimitSec",
    "memoryLimitMb",
    "maxParticipants",
    "endDate",
    "startDate",
  "status"
})
public class CreateContestRequest {

  @jakarta.validation.constraints.NotBlank(message = "제목은 필수입니다.")
  private String title;

  @jakarta.validation.constraints.NotBlank(message = "설명은 필수입니다.")
  private String description;

  @NotNull(message = "인증 여부는 필수입니다.")
  private Boolean certification;

  @NotNull(message = "시간 제한은 필수입니다.")
  @Positive(message = "시간 제한은 1 이상이어야 합니다.")
  @Schema(type = "integer", example = "3")
  private Integer timeLimitSec;

  @NotNull(message = "메모리 제한은 필수입니다.")
  @Positive(message = "메모리 제한은 1 이상이어야 합니다.")
  @Schema(type = "integer", example = "3")
  private Integer memoryLimitMb;

  // sampleCodeName 입력은 현재 비활성화한다. sample_code 파일명은 서버에서 고정값으로 처리한다.
  // @Schema(description = "sample_code 파일명(.cpp 제외). 미지정 시 sample_code 사용", example = "sample_solver")
  // private String sampleCodeName;

  @NotNull(message = "상태는 필수입니다.")
  @Schema(description = "대회 상태 (TEST, PLANNED, RUNNING, PAUSED, END, CANCELED)", example = "PLANNED")
  private ContestStatus status;

  @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
  @JsonAlias("start_date")
  @JsonDeserialize(using = FlexibleMinuteLocalDateTimeDeserializer.class)
  @Schema(description = "대회 시작 시각. 권장 형식: yyyy-MM-dd HH:mm (예: 2026-05-16 18:00). TEST 상태에서는 null로 저장됩니다.", type = "string", format = "date-time", example = "2026-05-16 19:00")
  private LocalDateTime startDate;

  @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
  @JsonAlias("end_date")
  @JsonDeserialize(using = FlexibleMinuteLocalDateTimeDeserializer.class)
  @Schema(description = "대회 종료 시각. 권장 형식: yyyy-MM-dd HH:mm (예: 2026-05-16 18:00). TEST 상태에서는 null로 저장됩니다.", type = "string", format = "date-time", example = "2026-05-16 19:00")
  private LocalDateTime endDate;

  @NotNull(message = "최대 참가자 수는 필수입니다.")
  @Positive(message = "최대 참가자 수는 1 이상이어야 합니다.")
  @Schema(type = "integer", example = "10")
  private Integer maxParticipants;
}
