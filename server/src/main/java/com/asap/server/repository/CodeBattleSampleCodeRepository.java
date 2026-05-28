package com.asap.server.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.asap.server.domain.CodeBattleSampleCode;

public interface CodeBattleSampleCodeRepository extends JpaRepository<CodeBattleSampleCode, Long> {
}