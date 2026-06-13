package com.asap.server.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.asap.server.domain.RefreshTokenMeta;
import com.asap.server.dto.request.AutoLoginRequest;
import com.asap.server.dto.request.EmailResendRequest;
import com.asap.server.dto.request.EmailVerifyRequest;
import com.asap.server.dto.request.LoginRequest;
import com.asap.server.dto.request.SignupRequest;
import com.asap.server.dto.request.SmsCodeVerifyRequest;
import com.asap.server.dto.request.SmsVerifyRequest;
import com.asap.server.dto.request.TempSignupRequest;
import com.asap.server.dto.request.WithdrawRequest;
import com.asap.server.dto.response.LoginResponse;
import com.asap.server.dto.response.TokenRefreshResponse;
import com.asap.server.service.AdminService;
import com.asap.server.service.AuthService;
import com.asap.server.service.TokenService;

import io.swagger.v3.oas.annotations.Operation;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping({ "/api/auth" })
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final TokenService tokenService;
    private final AdminService adminService;

    @PostMapping("/signup")
    public ResponseEntity<String> signup(@Valid @RequestBody SignupRequest request) {
        authService.signup(request);
        return ResponseEntity.status(201).body("회원가입이 완료되었습니다. 인증번호를 확인해주세요.");
    }

    @PostMapping("/withdraw")
    public ResponseEntity<String> withdraw(
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody WithdrawRequest request) {
        authService.withdraw(userId, request);
        return ResponseEntity.ok("회원탈퇴가 완료되었습니다.");
    }

    @PostMapping("/mail")
    public ResponseEntity<String> verifySignupMail(@RequestBody EmailVerifyRequest request) {
        authService.verifySignupMail(request);
        return ResponseEntity.ok("이메일 인증이 완료되었습니다.");
    }

    @PostMapping("/mail/send")
    public ResponseEntity<String> resendCode(@RequestBody EmailResendRequest request) {
        authService.resendMail(request);
        return ResponseEntity.status(200).body("이메일 인증번호를 재발송하였습니다.");
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    @Operation(summary = "로그아웃", description = "현재 세션만 로그아웃합니다.")
    public ResponseEntity<String> logout(
            @RequestHeader(value = "Authorization") String authHeader,
            @AuthenticationPrincipal Long userId,
            @RequestHeader(value = "X-Session-Id") String sessionId) {
        String accessToken = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
        authService.logout(userId, accessToken, sessionId);
        return ResponseEntity.ok("로그아웃되었습니다.");
    }

    @PostMapping("/logout-all")
    @Operation(summary = "모든 세션 로그아웃", description = "모든 디바이스에서 로그아웃합니다.")
    public ResponseEntity<String> logoutAll(@AuthenticationPrincipal Long userId) {
        authService.logoutAll(userId);
        return ResponseEntity.ok("모든 세션에서 로그아웃되었습니다.");
    }

    @PostMapping("/refresh")
    @Operation(summary = "토큰 재발급", description = "refresh token으로 새로운 access token을 발급받습니다.")
    public ResponseEntity<TokenRefreshResponse> refreshToken(
            @RequestBody com.asap.server.dto.request.TokenRefreshRequest request) {
        String newRefreshToken = tokenService.rotateRefreshToken(request.getRefreshToken(), "", "");
        RefreshTokenMeta meta = tokenService.validateAndGetRefreshTokenMeta(newRefreshToken);
        String newAccessToken = tokenService.issueAccessToken(meta.getUserId(), meta.getEmail());
        return ResponseEntity.ok(TokenRefreshResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .build());
    }

    @Operation(summary = "SMS 인증번호 발송")
    @PostMapping("/sms/send")
    public ResponseEntity<String> sendSMS(@Valid @RequestBody SmsVerifyRequest request) {
        authService.sendSMS(request);
        return ResponseEntity.ok("SMS 인증번호를 발송하였습니다.");
    }

    @Operation(summary = "SMS 인증 완료")
    @PostMapping("/sms/verify")
    public ResponseEntity<String> verifySMS(@Valid @RequestBody SmsCodeVerifyRequest request) {
        authService.verifySMS(request);
        return ResponseEntity.ok("SMS 인증이 완료되었습니다.");
    }

    @Operation(summary = "초대 링크 자동 로그인", description = "초대 메일의 일회용 토큰으로 로그인합니다.")
    @PostMapping("/auto-login")
    public ResponseEntity<LoginResponse> autoLogin(@Valid @RequestBody AutoLoginRequest request) {
        LoginResponse response = authService.autoLogin(request.getToken());
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "임시 계정 생성", description = "대회 참가용 임시 계정을 생성하고 로그인 정보와 자동 로그인 링크가 담긴 초대 메일을 발송합니다.")
    @PostMapping("/temp-signup")
    public ResponseEntity<String> createTempUser(
            @Valid @RequestBody TempSignupRequest request,
            HttpServletRequest httpRequest) {
        String clientIp = resolveClientIp(httpRequest);
        adminService.createTempUser(request, clientIp);
        return ResponseEntity.status(201).body("임시 계정이 생성되었고 초대 메일이 발송되었습니다.");
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}