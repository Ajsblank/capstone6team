package com.asap.server.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.asap.server.service.SseService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping({ "/api" })
@RequiredArgsConstructor
public class TestController {
    
    private final SseService sseService;
    
    @GetMapping("/test")
    public ResponseEntity<String> sendPingToUser4() {
        
        Long targetUserId = 4L;
        String message = "ping";
        
        sseService.sendToUser(targetUserId, message);
        
        return ResponseEntity.ok(targetUserId + "번 유저에게 SSE ping 전송을 시도했습니다.");
    }
}