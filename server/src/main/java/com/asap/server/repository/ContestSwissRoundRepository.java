package com.asap.server.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.asap.server.domain.ContestSwissRound;

public interface ContestSwissRoundRepository extends JpaRepository<ContestSwissRound, Long> {
  List<ContestSwissRound> findBySessionId(Long sessionId);
}