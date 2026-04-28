package com.asap.server.repository;

import com.asap.server.domain.CodeBattleSubmission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CodeBattleSubmissionRepository extends JpaRepository<CodeBattleSubmission, Long> {
}