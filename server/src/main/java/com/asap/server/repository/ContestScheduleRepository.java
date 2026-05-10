package com.asap.server.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.asap.server.domain.ContestSchedule;

public interface ContestScheduleRepository extends JpaRepository<ContestSchedule, Long> {

}
