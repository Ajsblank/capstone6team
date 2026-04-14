package com.asap.server.api.controller;

import com.asap.server.api.dto.request.LoginRequest;
import com.asap.server.api.dto.request.SignupRequest;
import com.asap.server.api.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    
    private final AuthService authService;
    
    @PostMapping("/signup")
    public ResponseEntity<String> signup(@Valid @RequestBody SignupRequest request) {
        authService.signup(request);
        return ResponseEntity.status(201).body("회원가입이 완료되었습니다!");
    }
    
    @PostMapping("/login")
    public ResponseEntity<String> login(@Valid @RequestBody LoginRequest request) {
        String result = authService.login(request);
        return ResponseEntity.ok(result);
    }
}