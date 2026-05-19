package com.asap.server.dto.response;

import java.time.LocalDateTime;

import com.asap.server.domain.ContestSchedule;
import com.asap.server.global.type.ContestStatus;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ContestScheduleListResponse {
  private Long scheduleId;
  private LocalDateTime scheduledAt;
  private ContestStatus status;

  public static ContestScheduleListResponse from(ContestSchedule schedule) {
    return new ContestScheduleListResponse(
        schedule.getId(),
        schedule.getScheduledAt(),
        schedule.getStatus());
  }
}