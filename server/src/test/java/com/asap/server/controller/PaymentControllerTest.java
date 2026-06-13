package com.asap.server.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import com.asap.server.dto.request.PaymentConfirmRequest;
import com.asap.server.dto.response.PaymentConfirmResponse;
import com.asap.server.service.PaymentService;

@ExtendWith(MockitoExtension.class)
@DisplayName("PaymentController 단위 테스트")
class PaymentControllerTest {

    @Mock
    private PaymentService paymentService;

    @InjectMocks
    private PaymentController paymentController;

    @Test
    @DisplayName("결제 승인 성공 → 200")
    void confirmPayment_success() {
        PaymentConfirmResponse mockResponse = mock(PaymentConfirmResponse.class);
        when(paymentService.confirmPayment(any(), anyLong())).thenReturn(mockResponse);

        ResponseEntity<?> result = paymentController.confirmPayment(new PaymentConfirmRequest(), 1L);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(result.getBody()).isEqualTo(mockResponse);
    }

    @Test
    @DisplayName("결제 승인 - IllegalArgumentException → 400")
    void confirmPayment_illegalArgument() {
        when(paymentService.confirmPayment(any(), anyLong()))
                .thenThrow(new IllegalArgumentException("이미 처리된 주문입니다."));

        ResponseEntity<?> result = paymentController.confirmPayment(new PaymentConfirmRequest(), 1L);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @DisplayName("결제 승인 - IllegalStateException → 500")
    void confirmPayment_illegalState() {
        when(paymentService.confirmPayment(any(), anyLong()))
                .thenThrow(new IllegalStateException("결제 처리 중 오류가 발생했습니다."));

        ResponseEntity<?> result = paymentController.confirmPayment(new PaymentConfirmRequest(), 1L);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
