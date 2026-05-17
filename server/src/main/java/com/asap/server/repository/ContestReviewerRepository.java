package com.asap.server.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.asap.server.domain.ContestReviewer;

@Repository
public interface ContestReviewerRepository extends JpaRepository<ContestReviewer, Long> {

  /**
   * 특정 대회의 모든 검수자 이메일 조회
   * 
   * @param contestId 대회 ID
   * @return 검수자 이메일 리스트
   */
  List<ContestReviewer> findByContestId(Long contestId);

  /**
   * 특정 대회의 검수자 수 조회
   * 
   * @param contestId 대회 ID
   * @return 검수자 수
   */
  long countByContestId(Long contestId);

  /**
   * 특정 대회의 검수자 모두 삭제
   * 
   * @param contestId 대회 ID
   */
  void deleteByContestId(Long contestId);

  @Query("select r.contest.id from ContestReviewer r where r.reviewerEmail = :email order by r.contest.id desc")
  List<Long> findContestIdsByReviewerEmail(@Param("email") String email);
}
