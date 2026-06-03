package com.asap.server.controller;

import java.util.Map;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.asap.server.dto.response.PaymentConfirmResponse;
import com.asap.server.service.PaymentService;
import com.asap.server.service.SseService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping({ "/api" })
@RequiredArgsConstructor
public class TestController {

    private final SseService sseService;
    private final PaymentService paymentService;

    @GetMapping("/test")
    public ResponseEntity<String> sendPingToUser4() {
        Long targetUserId = 4L;
        sseService.sendToUser(targetUserId, "ping");
        return ResponseEntity.ok(targetUserId + "번 유저에게 SSE ping 전송을 시도했습니다.");
    }

    @PostMapping("/test/payment")
    public ResponseEntity<?> testPayment(@RequestParam Long amount,
                                         @AuthenticationPrincipal Long userId) {
        try {
            String paymentKey = "test_pay_" + UUID.randomUUID();
            String orderId = "test_order_" + UUID.randomUUID();
            PaymentConfirmResponse response = paymentService.confirmPaymentForTest(paymentKey, orderId, amount, userId);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}