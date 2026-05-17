package com.asap.server.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.global.type.ContestStatus;

public interface CodeBattleContestRepository extends JpaRepository<CodeBattleContest, Long> {
    Page<CodeBattleContest> findByStatus(ContestStatus status, Pageable pageable);

    @Query("select c.id from CodeBattleContest c where c.creator.id = :userId order by c.id desc")
    List<Long> findContestIdsByCreatorId(@Param("userId") Long userId);
}
