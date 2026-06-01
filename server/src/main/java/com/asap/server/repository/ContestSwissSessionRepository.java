package com.asap.server.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.asap.server.domain.ContestSwissSession;

public interface ContestSwissSessionRepository extends JpaRepository<ContestSwissSession, Long> {
  List<ContestSwissSession> findByContestId(Long contestId);

  Optional<ContestSwissSession> findByContestIdAndSessionNumber(Long contestId, int sessionNumber);

  Optional<ContestSwissSession> findTopByContestIdAndSessionNumberOrderByIdDesc(Long contestId, int sessionNumber);
}