package com.asap.server.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.asap.server.domain.ContestSwissRound;
import com.asap.server.global.type.MatchStatus;

public interface ContestSwissRoundRepository extends JpaRepository<ContestSwissRound, Long> {
  List<ContestSwissRound> findBySessionId(Long sessionId);

  List<ContestSwissRound> findBySessionIdOrderByRoundNumber(Long sessionId);

  List<ContestSwissRound> findBySessionIdAndStatus(Long sessionId, MatchStatus status);

  List<ContestSwissRound> findBySessionIdAndStatusOrderByRoundNumber(Long sessionId, MatchStatus status);

}