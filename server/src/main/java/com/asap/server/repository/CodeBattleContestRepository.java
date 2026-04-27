package com.asap.server.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleContest.ContestStatus;

import jakarta.persistence.LockModeType;

public interface CodeBattleContestRepository extends JpaRepository<CodeBattleContest, Long> {
    Page<CodeBattleContest> findByStatus(ContestStatus status, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM CodeBattleContest c WHERE c.id = :id")
    Optional<CodeBattleContest> findByIdWithLock(@Param("id") Long id);
}
