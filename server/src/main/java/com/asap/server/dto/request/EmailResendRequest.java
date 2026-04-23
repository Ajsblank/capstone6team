package com.asap.server.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class EmailResendRequest {
  @NotBlank(message = "이메일은 필수입니다.")
  private String email;

}
