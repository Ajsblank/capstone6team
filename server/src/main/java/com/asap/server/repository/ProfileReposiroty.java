package com.asap.server.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.asap.server.domain.Profile;

public interface ProfileReposiroty extends JpaRepository<Profile, Long> {
  Optional<Profile> findByUserId(Long userId);

  boolean existsByUserId(Long userId);
}
