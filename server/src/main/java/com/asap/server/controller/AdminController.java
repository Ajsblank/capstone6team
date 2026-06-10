package com.asap.server.controller;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
    // 향후 관리자 전용 기능 추가 예정 (ROLE_ADMIN 인증 필요)
}
