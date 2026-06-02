package com.asap.server.dto.response;

import com.asap.server.domain.Payment;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class PaymentConfirmResponse {

    private Long id;
    private String paymentKey;
    private String orderId;
    private Long amount;
    private String status;
    private String method;
    private LocalDateTime paidAt;

    public static PaymentConfirmResponse from(Payment payment) {
        return PaymentConfirmResponse.builder()
                .id(payment.getId())
                .paymentKey(payment.getPaymentKey())
                .orderId(payment.getOrderId())
                .amount(payment.getAmount())
                .status(payment.getStatus())
                .method(payment.getMethod())
                .paidAt(payment.getPaidAt())
                .build();
    }
}
