package com.asap.server.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.asap.server.domain.CodeBattleMatch;

@Repository
public interface CodeBattleMatchRepository extends JpaRepository<CodeBattleMatch, Long> {

    List<CodeBattleMatch> findByContestId(Long contestId);

    List<CodeBattleMatch> findByUser1IdOrUser2Id(Long user1Id, Long user2Id);

    long countByContestId(Long contestId);

    @Query("SELECT COUNT(m) FROM CodeBattleMatch m WHERE m.contest.id = :contestId AND m.log IS NOT NULL")

    long countFinishedMatchesByContestId(@Param("contestId") Long contestId);

    CodeBattleMatch findByIdAndUser2Id(Long submissionId, Long user2Id);
}