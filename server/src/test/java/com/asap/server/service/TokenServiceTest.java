package com.asap.server.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Set;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Answers;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;

import com.asap.server.config.JwtTokenProvider;
import com.asap.server.domain.RefreshTokenMeta;
import com.fasterxml.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
@DisplayName("TokenService 단위 테스트")
class TokenServiceTest {

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @Mock(answer = Answers.RETURNS_DEEP_STUBS)
    private RedisTemplate<String, Object> redisTemplate;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private TokenService tokenService;

    private static final String TOKEN = "test.refresh.token";
    private static final Long USER_ID = 1L;
    private static final String EMAIL = "test@test.com";
    private static final String SESSION_ID = "session-123";

    // ─────────────────────────────────────────────────────────────
    // issueAccessToken
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("access token 발급 성공")
    void issueAccessToken_success() {
        when(jwtTokenProvider.createAccessToken(USER_ID, EMAIL)).thenReturn("access-token");

        String result = tokenService.issueAccessToken(USER_ID, EMAIL);

        assertThat(result).isEqualTo("access-token");
        verify(jwtTokenProvider).createAccessToken(USER_ID, EMAIL);
    }

    // ─────────────────────────────────────────────────────────────
    // issueRefreshToken
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("refresh token 발급 및 Redis 저장 성공")
    void issueRefreshToken_success() {
        when(jwtTokenProvider.createRefreshToken(USER_ID, EMAIL, SESSION_ID)).thenReturn("refresh-token");
        when(jwtTokenProvider.getRefreshTokenValidityMs()).thenReturn(86400000L);

        String result = tokenService.issueRefreshToken(USER_ID, EMAIL, SESSION_ID, "ua", "127.0.0.1");

        assertThat(result).isEqualTo("refresh-token");
        verify(jwtTokenProvider).createRefreshToken(USER_ID, EMAIL, SESSION_ID);
    }

    // ─────────────────────────────────────────────────────────────
    // validateAndGetRefreshTokenMeta
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("유효하지 않은 refresh token - 예외 발생")
    void validateAndGetRefreshTokenMeta_invalidToken() {
        when(jwtTokenProvider.validateToken(TOKEN)).thenReturn(false);

        assertThatThrownBy(() -> tokenService.validateAndGetRefreshTokenMeta(TOKEN))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("유효하지 않은 refresh token입니다.");
    }

    @Test
    @DisplayName("access token을 refresh에 사용 시 예외 발생")
    void validateAndGetRefreshTokenMeta_wrongTokenType() {
        when(jwtTokenProvider.validateToken(TOKEN)).thenReturn(true);
        when(jwtTokenProvider.getTokenType(TOKEN)).thenReturn("access");

        assertThatThrownBy(() -> tokenService.validateAndGetRefreshTokenMeta(TOKEN))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Access token은 refresh에 사용할 수 없습니다.");
    }

    @Test
    @DisplayName("Redis에 저장되지 않은 token - 예외 발생")
    void validateAndGetRefreshTokenMeta_notInRedis() {
        when(jwtTokenProvider.validateToken(TOKEN)).thenReturn(true);
        when(jwtTokenProvider.getTokenType(TOKEN)).thenReturn("refresh");
        when(jwtTokenProvider.getUserId(TOKEN)).thenReturn(USER_ID);
        when(jwtTokenProvider.getSessionId(TOKEN)).thenReturn(SESSION_ID);
        when(redisTemplate.opsForValue().get(anyString())).thenReturn(null);

        assertThatThrownBy(() -> tokenService.validateAndGetRefreshTokenMeta(TOKEN))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("저장되지 않은 또는 폐기된 refresh token입니다.");
    }

    @Test
    @DisplayName("토큰 해시 불일치 시 모든 세션 폐기 및 예외 발생")
    void validateAndGetRefreshTokenMeta_hashMismatch() throws Exception {
        RefreshTokenMeta meta = new RefreshTokenMeta(USER_ID, EMAIL, "wrong-hash", 0L, Long.MAX_VALUE, "", "");
        String metaJson = objectMapper.writeValueAsString(meta);

        when(jwtTokenProvider.validateToken(TOKEN)).thenReturn(true);
        when(jwtTokenProvider.getTokenType(TOKEN)).thenReturn("refresh");
        when(jwtTokenProvider.getUserId(TOKEN)).thenReturn(USER_ID);
        when(jwtTokenProvider.getSessionId(TOKEN)).thenReturn(SESSION_ID);
        when(redisTemplate.opsForValue().get(anyString())).thenReturn(metaJson);
        when(redisTemplate.opsForSet().members(anyString())).thenReturn(Set.of());

        assertThatThrownBy(() -> tokenService.validateAndGetRefreshTokenMeta(TOKEN))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("토큰 불일치");
    }

    @Test
    @DisplayName("정상 refresh token 검증 성공")
    void validateAndGetRefreshTokenMeta_success() throws Exception {
        String correctHash = sha256(TOKEN);
        RefreshTokenMeta meta = new RefreshTokenMeta(USER_ID, EMAIL, correctHash, 0L, Long.MAX_VALUE, "", "");
        String metaJson = objectMapper.writeValueAsString(meta);

        when(jwtTokenProvider.validateToken(TOKEN)).thenReturn(true);
        when(jwtTokenProvider.getTokenType(TOKEN)).thenReturn("refresh");
        when(jwtTokenProvider.getUserId(TOKEN)).thenReturn(USER_ID);
        when(jwtTokenProvider.getSessionId(TOKEN)).thenReturn(SESSION_ID);
        when(redisTemplate.opsForValue().get(anyString())).thenReturn(metaJson);

        RefreshTokenMeta result = tokenService.validateAndGetRefreshTokenMeta(TOKEN);

        assertThat(result.getUserId()).isEqualTo(USER_ID);
        assertThat(result.getEmail()).isEqualTo(EMAIL);
    }

    // ─────────────────────────────────────────────────────────────
    // blacklistAccessToken
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("유효하지 않은 token 블랙리스트 등록 - 무시")
    void blacklistAccessToken_invalidToken() {
        when(jwtTokenProvider.validateToken(TOKEN)).thenReturn(false);

        tokenService.blacklistAccessToken(TOKEN);
        // no exception
    }

    @Test
    @DisplayName("refresh token을 블랙리스트 등록 시 - 무시")
    void blacklistAccessToken_refreshType() {
        when(jwtTokenProvider.validateToken(TOKEN)).thenReturn(true);
        when(jwtTokenProvider.getTokenType(TOKEN)).thenReturn("refresh");

        tokenService.blacklistAccessToken(TOKEN);
        // no exception
    }

    @Test
    @DisplayName("유효한 access token 블랙리스트 등록 성공")
    void blacklistAccessToken_success() {
        when(jwtTokenProvider.validateToken(TOKEN)).thenReturn(true);
        when(jwtTokenProvider.getTokenType(TOKEN)).thenReturn("access");
        when(jwtTokenProvider.getJti(TOKEN)).thenReturn("jti-123");
        when(jwtTokenProvider.getExpirationTime(TOKEN)).thenReturn(System.currentTimeMillis() + 300000L);

        tokenService.blacklistAccessToken(TOKEN);

        verify(redisTemplate.opsForValue()).set(anyString(), anyString(), any());
    }

    // ─────────────────────────────────────────────────────────────
    // isAccessTokenBlacklisted
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("블랙리스트에 있는 access token")
    void isAccessTokenBlacklisted_true() {
        when(jwtTokenProvider.getJti(TOKEN)).thenReturn("jti-123");
        when(redisTemplate.hasKey(anyString())).thenReturn(true);

        assertThat(tokenService.isAccessTokenBlacklisted(TOKEN)).isTrue();
    }

    @Test
    @DisplayName("블랙리스트에 없는 access token")
    void isAccessTokenBlacklisted_false() {
        when(jwtTokenProvider.getJti(TOKEN)).thenReturn("jti-123");
        when(redisTemplate.hasKey(anyString())).thenReturn(false);

        assertThat(tokenService.isAccessTokenBlacklisted(TOKEN)).isFalse();
    }

    // ─────────────────────────────────────────────────────────────
    // revokeAllUserSessions
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("모든 세션 폐기 성공 - 세션 있음")
    void revokeAllUserSessions_withSessions() {
        when(redisTemplate.opsForSet().members(anyString())).thenReturn(Set.of("sess1", "sess2"));

        tokenService.revokeAllUserSessions(USER_ID);

        verify(redisTemplate).delete("auth:sessions:" + USER_ID);
    }

    @Test
    @DisplayName("모든 세션 폐기 - 세션 없어도 예외 없음")
    void revokeAllUserSessions_noSessions() {
        when(redisTemplate.opsForSet().members(anyString())).thenReturn(null);

        tokenService.revokeAllUserSessions(USER_ID);

        verify(redisTemplate).delete("auth:sessions:" + USER_ID);
    }

    // ─────────────────────────────────────────────────────────────
    // revokeSession
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("특정 세션 폐기 성공")
    void revokeSession_success() {
        tokenService.revokeSession(USER_ID, SESSION_ID);

        verify(redisTemplate).delete("auth:refresh:" + USER_ID + ":" + SESSION_ID);
        verify(redisTemplate.opsForSet()).remove("auth:sessions:" + USER_ID, SESSION_ID);
    }

    // ─────────────────────────────────────────────────────────────
    // Helper
    // ─────────────────────────────────────────────────────────────

    private static String sha256(String input) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        return Base64.getEncoder().encodeToString(digest.digest(input.getBytes(StandardCharsets.UTF_8)));
    }
}
