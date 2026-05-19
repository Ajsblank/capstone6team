package com.asap.server.dto.request;

import java.time.LocalDateTime;
import java.util.List;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ContestScheduleRequest {
  private List<@NotNull(message = "시작 시간에 null 값이 포함될 수 없습니다.") @Future(message = "시작 시간은 현재 이후여야 합니다.") LocalDateTime> scheduledTimes;
}