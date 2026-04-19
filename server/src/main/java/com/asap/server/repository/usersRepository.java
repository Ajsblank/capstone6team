package com.asap.server.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.asap.server.domain.users;

public interface usersRepository extends JpaRepository<users, Long> {
    Optional<users> findByEmail(String email);

    boolean existsByEmail(String email);
}