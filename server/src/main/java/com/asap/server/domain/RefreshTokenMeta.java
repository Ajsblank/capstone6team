package com.asap.server.domain;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class RefreshTokenMeta {
    private Long userId;
    private String email;
    private String tokenHash;
    private Long issuedAt;
    private Long expiresAt;
    private String userAgent;
    private String ipAddress;
}
