package com.asap.server.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import com.asap.server.config.JwtTokenProvider;
import com.asap.server.domain.RefreshTokenMeta;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class TokenService {

  private final JwtTokenProvider jwtTokenProvider;
  private final RedisTemplate<String, Object> redisTemplate;
  private final ObjectMapper objectMapper;

  private static final String REFRESH_TOKEN_PREFIX = "auth:refresh:";
  private static final String BLACKLIST_PREFIX = "auth:blacklist:";
  private static final String SESSION_INDEX_PREFIX = "auth:sessions:";

  /**
   * access token 발급
   */
  public String issueAccessToken(Long userId, String email) {
    return jwtTokenProvider.createAccessToken(userId, email);
  }

  /**
   * refresh token 발급 및 Redis 저장
   */
  public String issueRefreshToken(Long userId, String email, String sessionId, String userAgent,
      String ipAddress) {
    String refreshToken = jwtTokenProvider.createRefreshToken(userId, email, sessionId);
    saveRefreshTokenMeta(userId, email, sessionId, refreshToken, userAgent, ipAddress);
    return refreshToken;
  }

  /**
   * refresh token 메타 정보 Redis 저장
   */
  private void saveRefreshTokenMeta(Long userId, String email, String sessionId, String refreshToken,
      String userAgent, String ipAddress) {
    try {
      String tokenHash = hashToken(refreshToken);
      long now = System.currentTimeMillis();
      long expiresAt = now + jwtTokenProvider.getRefreshTokenValidityMs();

      RefreshTokenMeta meta = new RefreshTokenMeta(
          userId,
          email,
          tokenHash,
          now,
          expiresAt,
          userAgent,
          ipAddress);

      String key = REFRESH_TOKEN_PREFIX + userId + ":" + sessionId;
      redisTemplate.opsForValue().set(key, objectMapper.writeValueAsString(meta),
          java.time.Duration.ofMillis(jwtTokenProvider.getRefreshTokenValidityMs()));

      // 세션 인덱스에 추가
      redisTemplate.opsForSet().add(SESSION_INDEX_PREFIX + userId, sessionId);

      log.info("Refresh token 저장 - userId: {}, sessionId: {}", userId, sessionId);
    } catch (Exception e) {
      log.error("Refresh token 저장 실패", e);
      throw new IllegalStateException("Refresh token 저장 실패", e);
    }
  }

  /**
   * refresh token 검증 및 메타 조회
   */
  public RefreshTokenMeta validateAndGetRefreshTokenMeta(String refreshToken) {
    if (!jwtTokenProvider.validateToken(refreshToken)) {
      throw new IllegalArgumentException("유효하지 않은 refresh token입니다.");
    }

    String tokenType = jwtTokenProvider.getTokenType(refreshToken);
    if (!"refresh".equals(tokenType)) {
      throw new IllegalArgumentException("Access token은 refresh에 사용할 수 없습니다.");
    }

    Long userId = jwtTokenProvider.getUserId(refreshToken);
    String sessionId = jwtTokenProvider.getSessionId(refreshToken);
    String key = REFRESH_TOKEN_PREFIX + userId + ":" + sessionId;

    Object meta = redisTemplate.opsForValue().get(key);
    if (meta == null) {
      throw new IllegalArgumentException("저장되지 않은 또는 폐기된 refresh token입니다.");
    }

    try {
      RefreshTokenMeta tokenMeta = objectMapper.readValue((String) meta, RefreshTokenMeta.class);
      String storedHash = tokenMeta.getTokenHash();
      String receivedHash = hashToken(refreshToken);

      if (!storedHash.equals(receivedHash)) {
        // 해시 불일치 = 토큰 탈취 의심
        revokeAllUserSessions(userId);
        throw new IllegalStateException("토큰 불일치 - 모든 세션이 폐기되었습니다.");
      }

      return tokenMeta;
    } catch (IllegalStateException e) {
      throw e;
    } catch (Exception e) {
      log.error("Refresh token 메타 조회 실패", e);
      throw new IllegalStateException("Refresh token 메타 조회 실패", e);
    }
  }

  /**
   * refresh token 회전 (기존 폐기, 새로운 발급)
   */
  public String rotateRefreshToken(String oldRefreshToken, String userAgent, String ipAddress) {
    RefreshTokenMeta oldMeta = validateAndGetRefreshTokenMeta(oldRefreshToken);

    String sessionId = jwtTokenProvider.getSessionId(oldRefreshToken);
    // 기존 refresh token 제거
    String oldKey = REFRESH_TOKEN_PREFIX + oldMeta.getUserId() + ":" + sessionId;
    redisTemplate.delete(oldKey);

    // 새로운 refresh token 발급
    String newRefreshToken = issueRefreshToken(oldMeta.getUserId(), oldMeta.getEmail(), sessionId,
        userAgent, ipAddress);

    log.info("Refresh token 회전 - userId: {}, sessionId: {}", oldMeta.getUserId(), sessionId);
    return newRefreshToken;
  }

  /**
   * access token 블랙리스트 등록 (로그아웃)
   */
  public void blacklistAccessToken(String accessToken) {
    if (!jwtTokenProvider.validateToken(accessToken)) {
      return;
    }

    String tokenType = jwtTokenProvider.getTokenType(accessToken);
    if (!"access".equals(tokenType)) {
      return;
    }

    String jti = jwtTokenProvider.getJti(accessToken);
    String key = BLACKLIST_PREFIX + jti;
    long remainingMs = getRemainingTokenValidity(accessToken);

    if (remainingMs > 0) {
      redisTemplate.opsForValue().set(key, "logout",
          java.time.Duration.ofMillis(remainingMs));
      log.info("Access token 블랙리스트 등록 - jti: {}", jti);
    }
  }

  /**
   * access token이 블랙리스트에 있는지 확인
   */
  public boolean isAccessTokenBlacklisted(String accessToken) {
    String jti = jwtTokenProvider.getJti(accessToken);
    String key = BLACKLIST_PREFIX + jti;
    return Boolean.TRUE.equals(redisTemplate.hasKey(key));
  }

  /**
   * 사용자의 모든 세션 폐기 (logout-all)
   */
  public void revokeAllUserSessions(Long userId) {
    String sessionIndexKey = SESSION_INDEX_PREFIX + userId;
    var sessionIds = redisTemplate.opsForSet().members(sessionIndexKey);

    if (sessionIds != null) {
      for (Object sessionId : sessionIds) {
        String key = REFRESH_TOKEN_PREFIX + userId + ":" + sessionId;
        redisTemplate.delete(key);
      }
    }

    redisTemplate.delete(sessionIndexKey);
    log.info("모든 세션 폐기 - userId: {}", userId);
  }

  /**
   * 특정 세션 폐기
   */
  public void revokeSession(Long userId, String sessionId) {
    String key = REFRESH_TOKEN_PREFIX + userId + ":" + sessionId;
    redisTemplate.delete(key);

    String sessionIndexKey = SESSION_INDEX_PREFIX + userId;
    redisTemplate.opsForSet().remove(sessionIndexKey, sessionId);

    log.info("세션 폐기 - userId: {}, sessionId: {}", userId, sessionId);
  }

  /**
   * 토큰의 남은 유효시간(ms) 계산
   */
  private long getRemainingTokenValidity(String token) {
    try {
      long expirationTime = jwtTokenProvider.getExpirationTime(token);
      return Math.max(0, expirationTime - System.currentTimeMillis());
    } catch (Exception e) {
      return 0;
    }
  }

  /**
   * SHA256으로 토큰 해싱 (저장 시 보안)
   */
  private String hashToken(String token) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] encodedhash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
      return Base64.getEncoder().encodeToString(encodedhash);
    } catch (NoSuchAlgorithmException e) {
      throw new RuntimeException("SHA-256 해싱 실패", e);
    }
  }
}
