package com.asap.server.dto.response;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class LoginResponse {
    private Long userId;
    private String accessToken;
    private String refreshToken;
    private String sessionId;
    private List<Long> joinedContests;
    private List<Long> hostedContests;
}
