package com.asap.server.dto.request;

import java.time.LocalDateTime;
import java.util.List;

import com.asap.server.global.json.FlexibleMinuteLocalDateTimeDeserializer;
import com.asap.server.global.type.ContestStatus;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.Setter;

/**
 * 인증 대회 생성 요청
 * POST /api/contests/create/certified
 * 비인증 대회와 달리 reviewerEmails는 필수이며, visualizationHtml과 soloPlayHtml도 필수입니다.
 */
@Getter
@Setter
@Schema(description = "인증 대회 생성 요청")
@JsonPropertyOrder({
    "creatorId",
    "title",
    "description",
    "timeLimitSec",
    "memoryLimitMb",
    "maxParticipants",
    "startDate",
    "endDate",
    "status",
    "reviewerEmails"
})
public class CreateCertifiedContestRequest {

  @NotNull(message = "creatorId는 필수입니다.")
  @Schema(description = "대회 생성자 ID", example = "1")
  private Long creatorId;

  @NotNull(message = "인증 여부는 필수입니다.")
  @Schema(description = "인증 대회는 true", example = "true")
  private Boolean certification;

  @NotNull(message = "제목은 필수입니다.")
  @jakarta.validation.constraints.NotBlank(message = "제목은 필수입니다.")
  private String title;

  @NotNull(message = "설명은 필수입니다.")
  @jakarta.validation.constraints.NotBlank(message = "설명은 필수입니다.")
  private String description;

  @NotNull(message = "시간 제한은 필수입니다.")
  @Positive(message = "시간 제한은 1 이상이어야 합니다.")
  @Schema(type = "integer", example = "3")
  private Integer timeLimitSec;

  @NotNull(message = "메모리 제한은 필수입니다.")
  @Positive(message = "메모리 제한은 1 이상이어야 합니다.")
  @Schema(type = "integer", example = "256")
  private Integer memoryLimitMb;

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

  @NotEmpty(message = "검수자 이메일 리스트는 필수입니다. (최소 1명)")
  @Schema(description = "검수자 이메일 리스트 (필수, 최소 1명)", example = "[\"reviewer1@example.com\", \"reviewer2@example.com\"]")
  private List<String> reviewerEmails;

  @NotBlank(message = "judgeCode는 필수입니다.")
  @Schema(description = "채점 코드 파일 내용", example = "int main() { return 0; }")
  private String judgeCode;

  @NotEmpty(message = "sampleCode는 최소 1개 이상 필요입니다.")
  @Schema(description = "샘플 코드 파일 내용", example = "[{\"code\": \"int main() { return 0; }\", \"language\": \"CPP\"}]")
  private List<SampleCodeRequest> sampleCodes;
  @NotEmpty(message = "exampleAiCodes는 최소 1개 이상 필요합니다.")
  @Schema(description = "예제 AI 코드 목록", example = "[\"int main() { return 0; }\"]")
  private List<ExampleAiRequest> exampleAiCodes;

  @NotBlank(message = "visualizationHtml은 필수입니다.")
  @Schema(description = "시각화 HTML 내용", example = "<html><body>visualization</body></html>")
  private String visualizationHtml;

  @NotBlank(message = "soloPlayHtml은 필수입니다.")
  @Schema(description = "혼자하기 HTML 내용", example = "<html><body>solo play</body></html>")
  private String soloPlayHtml;
}
