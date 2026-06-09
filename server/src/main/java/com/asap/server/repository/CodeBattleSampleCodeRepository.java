package com.asap.server.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.asap.server.domain.CodeBattleSampleCode;

public interface CodeBattleSampleCodeRepository extends JpaRepository<CodeBattleSampleCode, Long> {
  List<CodeBattleSampleCode> findByContestIdOrderBySampleOrderAsc(Long contestId);

  List<CodeBattleSampleCode> findByContestId(Long contestId);
}