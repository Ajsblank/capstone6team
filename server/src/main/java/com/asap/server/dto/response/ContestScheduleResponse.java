package com.asap.server.dto.response;

import java.time.LocalDateTime;
import java.util.List;

import com.asap.server.domain.ContestSchedule;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ContestScheduleResponse {
  private List<LocalDateTime> scheduledTimes;

  public static ContestScheduleResponse from(List<ContestSchedule> schedules) {
    List<LocalDateTime> times = schedules.stream()
        .map(ContestSchedule::getScheduledAt)
        .toList();
    return new ContestScheduleResponse(times);
  }
}