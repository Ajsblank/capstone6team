package com.asap.server.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.asap.server.domain.ContestSwissMatch;
import com.asap.server.global.type.MatchStatus;

public interface ContestSwissMatchRepository extends JpaRepository<ContestSwissMatch, Long> {
  List<ContestSwissMatch> findByRoundId(Long roundId);

  List<ContestSwissMatch> findByRound_Session_IdAndRound_Status(
      Long sessionId, MatchStatus status);

  @Query("SELECT m FROM ContestSwissMatch m " +
      "LEFT JOIN FETCH m.user1 " +
      "LEFT JOIN FETCH m.user2 " +
      "LEFT JOIN FETCH m.winner " +
      "LEFT JOIN FETCH m.round r " +
      "LEFT JOIN FETCH r.session s " +
      "LEFT JOIN FETCH s.contest " +
      "WHERE m.id IN :ids")
  List<ContestSwissMatch> findAllByIdWithFetch(@Param("ids") List<Long> ids);
}
