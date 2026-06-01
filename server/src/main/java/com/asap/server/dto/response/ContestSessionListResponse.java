package com.asap.server.dto.response;

import java.time.LocalDateTime;

import com.asap.server.domain.ContestSwissSession;
import com.asap.server.global.type.ContestStatus;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ContestSessionListResponse {
  private Integer sessionNumber;
  private LocalDateTime scheduledAt;
  private ContestStatus status;

  public static ContestSessionListResponse from(ContestSwissSession session) {
    return new ContestSessionListResponse(
        session.getSessionNumber(),
        session.getScheduledAt(),
        session.getStatus());
  }
}
