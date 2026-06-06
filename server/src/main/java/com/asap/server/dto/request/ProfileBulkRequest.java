package com.asap.server.dto.request;

import java.util.List;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProfileBulkRequest {
  @jakarta.validation.constraints.NotEmpty(message = "유저 ID 목록은 필수이며 비어있을 수 없습니다.")
  private List<Long> userIds;
}
