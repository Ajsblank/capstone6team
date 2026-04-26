package com.asap.server.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.asap.server.domain.CodeBattleContest;

public interface CodeBattleContestRepository extends JpaRepository<CodeBattleContest, Long> {
}
