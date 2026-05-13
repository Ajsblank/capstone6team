package com.asap.server.repository;

import com.asap.server.domain.CodeBattleSubmission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CodeBattleSubmissionRepository extends JpaRepository<CodeBattleSubmission, Long> {
    List<CodeBattleSubmission> findByContestIdAndUserId(Long contestId, Long userId);
}