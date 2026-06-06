package com.asap.server.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ProfileListResponse {
  private String nicknameTag;
  private String imageUrl;
}
