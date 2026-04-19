package com.asap.server.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.asap.server.domain.AlgorithmProblem;

@Repository
public interface AlgorithmProblemRepository extends JpaRepository<AlgorithmProblem, Long> {
    
}