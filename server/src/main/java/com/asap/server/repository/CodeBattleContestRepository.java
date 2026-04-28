package com.asap.server.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleContest.ContestStatus;

public interface CodeBattleContestRepository extends JpaRepository<CodeBattleContest, Long> {
    Page<CodeBattleContest> findByStatus(ContestStatus status, Pageable pageable);
}
