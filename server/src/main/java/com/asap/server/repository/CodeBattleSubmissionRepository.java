package com.asap.server.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.asap.server.domain.CodeBattleSubmission;

@Repository
public interface CodeBattleSubmissionRepository extends JpaRepository<CodeBattleSubmission, Long> {
    List<CodeBattleSubmission> findByContestIdAndUserId(Long contestId, Long userId);

    List<CodeBattleSubmission> findByContest_Id(Long contestId);

    java.util.Optional<CodeBattleSubmission> findByIdAndContest_Id(Long submissionId, Long contestId);

}