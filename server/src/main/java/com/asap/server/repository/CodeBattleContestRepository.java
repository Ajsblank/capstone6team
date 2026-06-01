package com.asap.server.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.global.type.ContestStatus;

public interface CodeBattleContestRepository extends JpaRepository<CodeBattleContest, Long> {
    public interface ContestListProjection {
        Long getId();

        String getTitle();

        ContestStatus getStatus();

        LocalDateTime getStartDate();

        LocalDateTime getEndDate();

        Integer getMaxParticipants();
    }

    Page<CodeBattleContest> findByStatus(ContestStatus status, Pageable pageable);

    @Query("select c.id from CodeBattleContest c where c.creator.id = :userId order by c.id desc")
    List<Long> findContestIdsByCreatorId(@Param("userId") Long userId);

    Page<ContestListProjection> findByStatusAndDeletedAtIsNull(ContestStatus status, Pageable pageable);

    Page<ContestListProjection> findAllByDeletedAtIsNull(Pageable pageable);
}
