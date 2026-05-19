package com.asap.server.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.asap.server.domain.ContestSwissMatch;

public interface ContestSwissMatchRepository extends JpaRepository<ContestSwissMatch, Long> {
  List<ContestSwissMatch> findByRoundId(Long roundId);

  List<ContestSwissMatch> findByRound_Session_Id(Long sessionId);
}
