package com.asap.server.repository;

import com.asap.server.domain.CodeBattleExampleAI;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CodeBattleExampleAIRepository extends JpaRepository<CodeBattleExampleAI, Long> {
    List<CodeBattleExampleAI> findByContestIdOrderByExampleOrderAsc(Long contestId);
}