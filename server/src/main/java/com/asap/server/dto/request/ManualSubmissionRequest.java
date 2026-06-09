package com.asap.server.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class ManualSubmissionRequest {
  @NotNull
  private Long submissionId;
}
