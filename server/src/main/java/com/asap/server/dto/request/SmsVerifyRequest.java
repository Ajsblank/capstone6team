package com.asap.server.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SmsVerifyRequest {
  @NotBlank(message = "휴대전화 정보는 필수입니다.")
  @Pattern(regexp = "^01(?:0|1|[6-9])(?:\\d{3}|\\d{4})\\d{4}$", message = "올바른 휴대전화 번호 형식이 아닙니다.")
  String phoneNumber;
}
