package com.asap.server.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import com.asap.server.domain.RefreshTokenMeta;
import com.asap.server.dto.request.EmailResendRequest;
import com.asap.server.dto.request.EmailVerifyRequest;
import com.asap.server.dto.request.LoginRequest;
import com.asap.server.dto.request.SignupRequest;
import com.asap.server.dto.request.SmsCodeVerifyRequest;
import com.asap.server.dto.request.SmsVerifyRequest;
import com.asap.server.dto.request.TokenRefreshRequest;
import com.asap.server.dto.request.WithdrawRequest;
import com.asap.server.dto.response.LoginResponse;
import com.asap.server.service.AuthService;
import com.asap.server.service.TokenService;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuthController 단위 테스트")
class AuthControllerTest {

    @Mock private AuthService authService;
    @Mock private TokenService tokenService;

    @InjectMocks
    private AuthController authController;

    @Test
    @DisplayName("회원가입 성공 → 201")
    void signup_success() {
        doNothing().when(authService).signup(any(SignupRequest.class));

        ResponseEntity<String> result = authController.signup(new SignupRequest());

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(result.getBody()).contains("회원가입이 완료되었습니다");
    }

    @Test
    @DisplayName("회원탈퇴 성공 → 200")
    void withdraw_success() {
        doNothing().when(authService).withdraw(any(), any());

        ResponseEntity<String> result = authController.withdraw(1L, new WithdrawRequest());

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(result.getBody()).contains("회원탈퇴");
    }

    @Test
    @DisplayName("이메일 인증 성공 → 200")
    void verifySignupMail_success() {
        doNothing().when(authService).verifySignupMail(any());

        ResponseEntity<String> result = authController.verifySignupMail(new EmailVerifyRequest());

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(result.getBody()).contains("이메일 인증이 완료되었습니다");
    }

    @Test
    @DisplayName("이메일 인증코드 재발송 성공 → 200")
    void resendCode_success() {
        doNothing().when(authService).resendMail(any());

        ResponseEntity<String> result = authController.resendCode(new EmailResendRequest());

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("로그인 성공 → 200")
    void login_success() {
        LoginResponse mockResponse = mock(LoginResponse.class);
        when(authService.login(any(LoginRequest.class))).thenReturn(mockResponse);

        ResponseEntity<LoginResponse> result = authController.login(new LoginRequest());

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(result.getBody()).isEqualTo(mockResponse);
    }

    @Test
    @DisplayName("로그아웃 성공 - Bearer prefix 있음")
    void logout_withBearer() {
        doNothing().when(authService).logout(any(), anyString(), anyString());

        ResponseEntity<String> result = authController.logout("Bearer mytoken", 1L, "sess1");

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(authService).logout(1L, "mytoken", "sess1");
    }

    @Test
    @DisplayName("로그아웃 성공 - Bearer prefix 없음")
    void logout_withoutBearer() {
        doNothing().when(authService).logout(any(), anyString(), anyString());

        ResponseEntity<String> result = authController.logout("rawtoken", 1L, "sess1");

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(authService).logout(1L, "rawtoken", "sess1");
    }

    @Test
    @DisplayName("모든 세션 로그아웃 성공")
    void logoutAll_success() {
        doNothing().when(authService).logoutAll(any());

        ResponseEntity<String> result = authController.logoutAll(1L);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(authService).logoutAll(1L);
    }

    @Test
    @DisplayName("토큰 재발급 성공")
    void refreshToken_success() {
        RefreshTokenMeta meta = new RefreshTokenMeta(1L, "test@test.com", "hash", 0L, 0L, "", "");
        when(tokenService.rotateRefreshToken(anyString(), anyString(), anyString())).thenReturn("new-refresh");
        when(tokenService.validateAndGetRefreshTokenMeta("new-refresh")).thenReturn(meta);
        when(tokenService.issueAccessToken(1L, "test@test.com")).thenReturn("new-access");

        TokenRefreshRequest request = new TokenRefreshRequest();
        request.setRefreshToken("old-refresh");

        ResponseEntity<?> result = authController.refreshToken(request);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("SMS 인증번호 발송 성공")
    void sendSMS_success() {
        doNothing().when(authService).sendSMS(any());

        ResponseEntity<String> result = authController.sendSMS(new SmsVerifyRequest());

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("SMS 인증 완료 성공")
    void verifySMS_success() {
        doNothing().when(authService).verifySMS(any());

        ResponseEntity<String> result = authController.verifySMS(new SmsCodeVerifyRequest());

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
