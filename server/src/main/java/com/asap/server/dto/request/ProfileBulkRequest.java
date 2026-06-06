package com.asap.server.dto.request;

import java.util.List;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProfileBulkRequest {
  private List<Long> userIds;
}
