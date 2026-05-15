package com.asap.server.dto.request;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class TokenRefreshRequest {
    private String refreshToken;
}
