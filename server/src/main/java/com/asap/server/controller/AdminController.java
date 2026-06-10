package com.asap.server.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.asap.server.dto.request.AdminCreateUserRequest;
import com.asap.server.service.AdminService;

import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @Operation(summary = "관리자 계정 생성",
            description = "닉네임과 이메일을 입력받아 랜덤 비밀번호로 계정을 생성하고, 로그인 정보와 자동 로그인 링크가 포함된 초대 메일을 발송합니다.")
    @PostMapping("/users")
    public ResponseEntity<String> createUser(@Valid @RequestBody AdminCreateUserRequest request) {
        adminService.createUserByAdmin(request);
        return ResponseEntity.status(201).body("계정이 생성되었고 초대 메일이 발송되었습니다.");
    }
}
