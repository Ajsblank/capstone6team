package com.asap.server.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateProfileRequest {

  @NotBlank(message = "닉네임은 필수입니다.")
  private String nickname;
  private String bio;
  private String affiliation;
  private String imageUrl;
}
