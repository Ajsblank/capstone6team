package com.asap.server.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import com.asap.server.domain.Payment;
import com.asap.server.domain.Users;
import com.asap.server.dto.request.PaymentConfirmRequest;
import com.asap.server.dto.response.PaymentConfirmResponse;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.PaymentRepository;
import com.asap.server.repository.usersRepository;

@ExtendWith(MockitoExtension.class)
@DisplayName("PaymentService 단위 테스트")
class PaymentServiceTest {

    @Mock private PaymentRepository paymentRepository;
    @Mock private CodeBattleContestRepository contestRepository;
    @Mock private usersRepository userRepository;
    @Mock private TransactionTemplate transactionTemplate;
    @Mock private RestClient restClient;

    @InjectMocks
    private PaymentService paymentService;

    // RestClient 플루언트 체인 개별 mock
    private RestClient.RequestBodyUriSpec requestBodyUriSpec;
    private RestClient.RequestBodySpec requestBodySpec;
    private RestClient.RequestHeadersSpec<?> requestHeadersSpec;
    private RestClient.ResponseSpec responseSpec;

    private Users testUser;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(paymentService, "secretKey", "test_sk_xxxx");
        ReflectionTestUtils.setField(paymentService, "restClient", restClient);

        testUser = Users.builder()
                .id(1L)
                .email("test@test.com")
                .password("encodedPassword")
                .build();

        // RestClient 체인 단계별 설정
        requestBodyUriSpec = mock(RestClient.RequestBodyUriSpec.class);
        requestBodySpec    = mock(RestClient.RequestBodySpec.class);
        requestHeadersSpec = mock(RestClient.RequestHeadersSpec.class);
        responseSpec       = mock(RestClient.ResponseSpec.class);

        lenient().when(restClient.post()).thenReturn(requestBodyUriSpec);
        lenient().when(requestBodyUriSpec.uri(anyString())).thenReturn(requestBodySpec);
        lenient().when(requestBodySpec.header(anyString())).thenReturn(requestBodySpec);
        lenient().when(requestBodySpec.contentType(any(MediaType.class))).thenReturn(requestBodySpec);
        lenient().when(requestBodySpec.body(any())).thenAnswer(inv -> requestHeadersSpec);
        lenient().when(requestHeadersSpec.retrieve()).thenReturn(responseSpec);
    }

    // TransactionTemplate 이 콜백을 실제로 실행하도록 설정
    @SuppressWarnings("unchecked")
    private void setupTransactionTemplate() {
        when(transactionTemplate.execute(any())).thenAnswer(invocation -> {
            TransactionCallback<?> callback = invocation.getArgument(0);
            return callback.doInTransaction(null);
        });
    }

    // ─────────────────────────────────────────────────────────────
    // confirmPayment
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("결제 금액 불일치 시 예외 발생 (고정 금액: 100,000원)")
    void confirmPayment_wrongAmount() {
        PaymentConfirmRequest request = buildRequest("pk_test", "order_001", 50000L, null);

        assertThatThrownBy(() -> paymentService.confirmPayment(request, 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("결제 금액이 올바르지 않습니다.");
    }

    @Test
    @DisplayName("이미 처리된 주문 ID 재요청 시 예외 발생")
    void confirmPayment_duplicateOrderId() {
        PaymentConfirmRequest request = buildRequest("pk_test", "order_001", 100000L, null);
        when(paymentRepository.existsByOrderId("order_001")).thenReturn(true);

        assertThatThrownBy(() -> paymentService.confirmPayment(request, 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("이미 처리된 주문입니다.");
    }

    @Test
    @DisplayName("토스 API 4xx 오류 시 IllegalArgumentException 발생")
    void confirmPayment_tossApi4xxError() {
        PaymentConfirmRequest request = buildRequest("pk_test", "order_001", 100000L, null);
        when(paymentRepository.existsByOrderId("order_001")).thenReturn(false);
        when(restClient.post())
                .thenThrow(new HttpClientErrorException(HttpStatus.BAD_REQUEST, "결제 키 오류"));

        assertThatThrownBy(() -> paymentService.confirmPayment(request, 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("결제 승인에 실패했습니다");
    }

    @Test
    @DisplayName("토스 API 네트워크 오류 시 IllegalStateException 발생")
    void confirmPayment_tossApiNetworkError() {
        PaymentConfirmRequest request = buildRequest("pk_test", "order_001", 100000L, null);
        when(paymentRepository.existsByOrderId("order_001")).thenReturn(false);
        when(restClient.post())
                .thenThrow(new RuntimeException("Connection refused"));

        assertThatThrownBy(() -> paymentService.confirmPayment(request, 1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("결제 처리 중 오류가 발생했습니다.");
    }

    // ─────────────────────────────────────────────────────────────
    // confirmPaymentForTest (토스 API 호출 없음)
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("테스트 결제 성공 - DB에 저장되고 응답 반환")
    void confirmPaymentForTest_success() {
        setupTransactionTemplate();

        Payment saved = Payment.create("pk_test", "order_001", 100000L,
                "DONE", "카드", LocalDateTime.now(), null, testUser);

        when(paymentRepository.existsByOrderId("order_001")).thenReturn(false);
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(paymentRepository.save(any(Payment.class))).thenReturn(saved);

        PaymentConfirmResponse response = paymentService.confirmPaymentForTest("pk_test", "order_001", 1L);

        assertThat(response).isNotNull();
        assertThat(response.getPaymentKey()).isEqualTo("pk_test");
        assertThat(response.getOrderId()).isEqualTo("order_001");
        assertThat(response.getAmount()).isEqualTo(100000L);
        assertThat(response.getStatus()).isEqualTo("DONE");
        assertThat(response.getMethod()).isEqualTo("카드");
        verify(paymentRepository).save(any(Payment.class));
    }

    @Test
    @DisplayName("테스트 결제 - 중복 주문 ID 예외 발생")
    void confirmPaymentForTest_duplicateOrderId() {
        when(paymentRepository.existsByOrderId("order_dup")).thenReturn(true);

        assertThatThrownBy(() -> paymentService.confirmPaymentForTest("pk_test", "order_dup", 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("이미 처리된 주문입니다.");
    }

    @Test
    @DisplayName("테스트 결제 - 사용자 없음 예외 발생")
    void confirmPaymentForTest_userNotFound() {
        setupTransactionTemplate();
        when(paymentRepository.existsByOrderId("order_001")).thenReturn(false);
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> paymentService.confirmPaymentForTest("pk_test", "order_001", 99L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("사용자를 찾을 수 없습니다.");
    }

    // ─────────────────────────────────────────────────────────────
    // Helper
    // ─────────────────────────────────────────────────────────────

    private PaymentConfirmRequest buildRequest(String paymentKey, String orderId, Long amount, Long contestId) {
        PaymentConfirmRequest request = new PaymentConfirmRequest();
        ReflectionTestUtils.setField(request, "paymentKey", paymentKey);
        ReflectionTestUtils.setField(request, "orderId", orderId);
        ReflectionTestUtils.setField(request, "amount", amount);
        ReflectionTestUtils.setField(request, "contestId", contestId);
        return request;
    }
}
