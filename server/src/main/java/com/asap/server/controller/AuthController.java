package com.asap.server.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.asap.server.dto.request.EmailResendRequest;
import com.asap.server.dto.request.EmailVerifyRequest;
import com.asap.server.dto.request.LoginRequest;
import com.asap.server.dto.request.SignupRequest;
import com.asap.server.dto.request.SmsCodeVerifyRequest;
import com.asap.server.dto.request.SmsVerifyRequest;
import com.asap.server.dto.request.WithdrawRequest;
import com.asap.server.dto.response.LoginResponse;
import com.asap.server.service.AuthService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping({ "/api/auth" })
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/signup")
    public ResponseEntity<String> signup(@Valid @RequestBody SignupRequest request) {
        authService.signup(request);
        return ResponseEntity.status(201).body("회원가입이 완료되었습니다. 인증번호를 확인해주세요.");
    }

    // @PostMapping("/signout")
    // public ResponseEntity<String> singout(@RequestBody SignoutRequest request) {
    // authService.signout(request);
    // return ResponseEntity.ok("로그아웃이 완료됐습니다.")
    // }

    @PostMapping("/withdraw")
    public ResponseEntity<String> withdraw(
            @AuthenticationPrincipal String email,
            @Valid @RequestBody WithdrawRequest request) {
        authService.withdraw(email, request);
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

    @PostMapping("/sms/send")
    public ResponseEntity<String> sendSMS(@Valid @RequestBody SmsVerifyRequest request) {
        authService.sendSMS(request);
        return ResponseEntity.ok("SMS 인증번호를 발송하였습니다.");
    }

    @PostMapping("/sms/verify")
    public ResponseEntity<String> verifySMS(@Valid @RequestBody SmsCodeVerifyRequest request) {
        authService.verifySMS(request);
        return ResponseEntity.ok("SMS 인증이 완료되었습니다.");
    }
}