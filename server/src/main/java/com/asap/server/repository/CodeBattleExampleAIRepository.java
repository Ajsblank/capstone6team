package com.asap.server.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.asap.server.domain.CodeBattleExampleAI;

@Repository
public interface CodeBattleExampleAIRepository extends JpaRepository<CodeBattleExampleAI, Long> {
    List<CodeBattleExampleAI> findByContestIdOrderByExampleOrderAsc(Long contestId);

    List<CodeBattleExampleAI> findByContest_id(Long contestId);

    void deleteByContest_Id(Long contestId);
}