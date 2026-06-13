package com.asap.server.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AutoLoginRequest {

    @NotBlank(message = "토큰은 필수입니다.")
    private String token;
}
