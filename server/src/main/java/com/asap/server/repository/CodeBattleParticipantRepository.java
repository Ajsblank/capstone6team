package com.asap.server.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

import com.asap.server.domain.CodeBattleParticipant;

public interface CodeBattleParticipantRepository extends JpaRepository<CodeBattleParticipant, Long> {

    boolean existsByUserIdAndContestId(Long userId, Long contestId);

    long countByContestId(Long contestId);

    Optional<CodeBattleParticipant> findByUserIdAndContestId(Long userId, Long contestId);

    Page<CodeBattleParticipant> findAllByContestId(Long contestId, Pageable pageable);

    List<CodeBattleParticipant> findByContestId(Long contestId);

    CodeBattleParticipant findByContestIdAndUserId(Long contestId, Long userId);
}
