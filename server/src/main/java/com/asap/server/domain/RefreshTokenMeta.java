package com.asap.server.domain;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
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
