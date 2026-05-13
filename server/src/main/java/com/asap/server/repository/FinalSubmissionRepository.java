package com.asap.server.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.asap.server.domain.ContestFinalSubmission;

public interface FinalSubmissionRepository extends JpaRepository<ContestFinalSubmission, Long> {
  Optional<ContestFinalSubmission> findByUserIdAndContestId(
      Long userId,
      Long contestId);

  List<ContestFinalSubmission> findByContestId(Long contestId);

  Optional<ContestFinalSubmission> findByContestIdAndSubmissionId(Long contestId, Long submissionId);
}