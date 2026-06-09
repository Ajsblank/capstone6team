package com.asap.server.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "payment")
@Getter
@Setter
@NoArgsConstructor
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "payment_key", nullable = false, unique = true)
    private String paymentKey;

    @Column(name = "order_id", nullable = false, unique = true)
    private String orderId;

    @Column(nullable = false)
    private Long amount;

    @Column(nullable = false)
    private String status;

    private String method;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contest_id", foreignKey = @ForeignKey(name = "fk_payment_contest"))
    private CodeBattleContest contest;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", foreignKey = @ForeignKey(name = "fk_payment_user"))
    private Users user;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @Column(nullable = false, name = "created_at")
    private LocalDateTime createdAt;

    @Column(nullable = false, name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public static Payment create(String paymentKey, String orderId, Long amount,
                                  String status, String method, LocalDateTime paidAt,
                                  CodeBattleContest contest, Users user) {
        Payment payment = new Payment();
        payment.paymentKey = paymentKey;
        payment.orderId = orderId;
        payment.amount = amount;
        payment.status = status;
        payment.method = method;
        payment.paidAt = paidAt;
        payment.contest = contest;
        payment.user = user;
        return payment;
    }
}
