package com.asap.server.service;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.Payment;
import com.asap.server.domain.Users;
import com.asap.server.dto.request.PaymentConfirmRequest;
import com.asap.server.dto.response.PaymentConfirmResponse;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.PaymentRepository;
import com.asap.server.repository.usersRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Map;

@Service
@Slf4j
public class PaymentService {

    private static final String TOSS_CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm";

    private final PaymentRepository paymentRepository;
    private final CodeBattleContestRepository contestRepository;
    private final usersRepository userRepository;
    private final TransactionTemplate transactionTemplate;
    private final RestClient restClient;

    @Value("${toss.secret-key}")
    private String secretKey;

    public PaymentService(PaymentRepository paymentRepository,
                          CodeBattleContestRepository contestRepository,
                          usersRepository userRepository,
                          TransactionTemplate transactionTemplate) {
        this.paymentRepository = paymentRepository;
        this.contestRepository = contestRepository;
        this.userRepository = userRepository;
        this.transactionTemplate = transactionTemplate;
        this.restClient = RestClient.create();
    }

    // 트랜잭션 없음 — 토스 API 호출 중 DB 커넥션 점유 방지
    public PaymentConfirmResponse confirmPayment(PaymentConfirmRequest request, Long userId) {
        if (paymentRepository.existsByOrderId(request.getOrderId())) {
            throw new IllegalArgumentException("이미 처리된 주문입니다.");
        }

        // 트랜잭션 밖에서 외부 API 호출
        TossPaymentResponse tossResponse = callTossConfirmApi(
                request.getPaymentKey(), request.getOrderId(), request.getAmount());

        // DB 저장만 트랜잭션으로 분리
        return transactionTemplate.execute(status -> {
            Users user = userRepository.findById(userId)
                    .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

            CodeBattleContest contest = null;
            if (request.getContestId() != null) {
                contest = contestRepository.findById(request.getContestId())
                        .orElseThrow(() -> new IllegalArgumentException("대회를 찾을 수 없습니다."));
            }

            LocalDateTime paidAt = tossResponse.approvedAt() != null
                    ? OffsetDateTime.parse(tossResponse.approvedAt()).toLocalDateTime()
                    : LocalDateTime.now();

            Payment payment = Payment.create(
                    request.getPaymentKey(),
                    request.getOrderId(),
                    request.getAmount(),
                    tossResponse.status(),
                    tossResponse.method(),
                    paidAt,
                    contest,
                    user);

            Payment saved = paymentRepository.save(payment);
            log.info("[결제 완료] paymentKey={}, orderId={}, amount={}, userId={}",
                    request.getPaymentKey(), request.getOrderId(), request.getAmount(), userId);
            return PaymentConfirmResponse.from(saved);
        });
    }

    public PaymentConfirmResponse confirmPaymentForTest(String paymentKey, String orderId, Long amount, Long userId) {
        if (amount == null || amount <= 0) {
            throw new IllegalArgumentException("결제 금액은 0보다 커야 합니다.");
        }
        if (paymentRepository.existsByOrderId(orderId)) {
            throw new IllegalArgumentException("이미 처리된 주문입니다.");
        }
        return transactionTemplate.execute(status -> {
            Users user = userRepository.findById(userId)
                    .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
            Payment payment = Payment.create(
                    paymentKey, orderId, amount,
                    "DONE", "카드", LocalDateTime.now(), null, user);
            Payment saved = paymentRepository.save(payment);
            log.info("[테스트 결제 완료] paymentKey={}, orderId={}, userId={}", paymentKey, orderId, userId);
            return PaymentConfirmResponse.from(saved);
        });
    }

    private TossPaymentResponse callTossConfirmApi(String paymentKey, String orderId, Long amount) {
        String encoded = Base64.getEncoder()
                .encodeToString((secretKey + ":").getBytes(StandardCharsets.UTF_8));
        try {
            return restClient.post()
                    .uri(TOSS_CONFIRM_URL)
                    .header("Authorization", "Basic " + encoded)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("paymentKey", paymentKey, "orderId", orderId, "amount", amount))
                    .retrieve()
                    .body(TossPaymentResponse.class);
        } catch (HttpClientErrorException e) {
            log.warn("[토스 결제 승인 실패] status={}, body={}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new IllegalArgumentException("결제 승인에 실패했습니다: " + e.getResponseBodyAsString());
        } catch (Exception e) {
            log.error("[토스 결제 승인 오류] paymentKey={}, error={}", paymentKey, e.getMessage());
            throw new IllegalStateException("결제 처리 중 오류가 발생했습니다.");
        }
    }

    private record TossPaymentResponse(
            String paymentKey,
            String orderId,
            Long totalAmount,
            String status,
            String method,
            String approvedAt
    ) {}
}
