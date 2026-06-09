package com.asap.server.repository;

import com.asap.server.domain.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    boolean existsByOrderId(String orderId);
    Optional<Payment> findByContestId(Long contestId);
}
