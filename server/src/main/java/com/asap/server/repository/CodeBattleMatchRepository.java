package com.asap.server.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.asap.server.domain.CodeBattleMatch;

@Repository
public interface CodeBattleMatchRepository extends JpaRepository<CodeBattleMatch, Long> {

    List<CodeBattleMatch> findByContestId(Long contestId);

    List<CodeBattleMatch> findByUser1IdOrUser2Id(Long user1Id, Long user2Id);

    long countByContestId(Long contestId);

    CodeBattleMatch findByIdAndUser2Id(Long submissionId, Long user2Id);

    Optional<CodeBattleMatch> findByContestIdAndUser1IdAndUser2Id(
            Long contestId,
            Long user1Id,
            Long user2Id);

    long countFinishedMatchesByContestId(Long contestId);

}