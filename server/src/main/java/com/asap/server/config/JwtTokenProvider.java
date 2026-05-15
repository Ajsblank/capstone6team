package com.asap.server.config;

import java.nio.charset.StandardCharsets;
import java.util.Date;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.util.UUID;

@Component
public class JwtTokenProvider {

    private final SecretKey key;
    private final long accessTokenValidityMs;
    private final long refreshTokenValidityMs;

    public JwtTokenProvider(
            @Value("${jwt.secret}") String secretKey,
            @Value("${jwt.expiration}") long accessTokenValidityMs) {
        this.key = Keys.hmacShaKeyFor(secretKey.getBytes(StandardCharsets.UTF_8));
        this.accessTokenValidityMs = accessTokenValidityMs;
        this.refreshTokenValidityMs = 7L * 24 * 60 * 60 * 1000; // 7 days
    }

    // access token 생성 (userId, email, type claim 포함)
    public String createAccessToken(Long userId, String email) {
        Date now = new Date();
        Date validity = new Date(now.getTime() + accessTokenValidityMs);
        String jti = UUID.randomUUID().toString();

        return Jwts.builder()
                .subject(userId.toString())
                .claim("email", email)
                .claim("type", "access")
                .claim("jti", jti)
                .issuedAt(now)
                .expiration(validity)
                .signWith(key)
                .compact();
    }

    // refresh token 생성 (userId, email, type, sessionId claim 포함)
    public String createRefreshToken(Long userId, String email, String sessionId) {
        Date now = new Date();
        Date validity = new Date(now.getTime() + refreshTokenValidityMs);
        String jti = UUID.randomUUID().toString();

        return Jwts.builder()
                .subject(userId.toString())
                .claim("email", email)
                .claim("type", "refresh")
                .claim("jti", jti)
                .claim("sessionId", sessionId)
                .issuedAt(now)
                .expiration(validity)
                .signWith(key)
                .compact();
    }

    public Long getUserId(String token) {
        return Long.parseLong(Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(token).getPayload().getSubject());
    }

    public String getEmail(String token) {
        return (String) Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(token).getPayload().get("email");
    }

    public String getJti(String token) {
        return (String) Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(token).getPayload().get("jti");
    }

    public String getTokenType(String token) {
        return (String) Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(token).getPayload().get("type");
    }

    public String getSessionId(String token) {
        return (String) Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(token).getPayload().get("sessionId");
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parser().verifyWith(key).build().parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public long getAccessTokenValidityMs() {
        return accessTokenValidityMs;
    }

    public long getRefreshTokenValidityMs() {
        return refreshTokenValidityMs;
    }

    public long getExpirationTime(String token) {
        var claims = Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(token).getPayload();
        return claims.getExpiration().getTime();
    }
}