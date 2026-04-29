package com.asap.server.repository;

import com.asap.server.domain.CodeBattleMatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CodeBattleMatchRepository extends JpaRepository<CodeBattleMatch, Long> {
}