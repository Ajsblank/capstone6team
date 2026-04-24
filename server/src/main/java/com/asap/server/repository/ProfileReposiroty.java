package com.asap.server.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.asap.server.domain.Profile;

public interface ProfileReposiroty extends JpaRepository<Profile, Long> {
  Optional<Profile> findByUserId(Long userId);

  boolean existsByUserId(Long userId);

  boolean existsByNicknameAndTag(String nickname, Integer tag);

  @Query("SELECT COALESCE(MAX(p.tag), 0) FROM Profile p WHERE p.nickname = :nickname")
  Integer findMaxTagByNickname(@Param("nickname") String nickname);
}
