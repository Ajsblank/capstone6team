package com.asap.server.service;

import org.springframework.stereotype.Service;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleContest.ContestStatus;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.CodeBattleParticipantRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ContestRunService {
  private final CodeBattleContestRepository contestRepository;
  private final CodeBattleParticipantRepository participantRepository;

  public void RunContest(long contestId) {
    CodeBattleContest contest = contestRepository.findById(contestId)
        .orElseThrow(() -> new IllegalArgumentException("대회를 찾을 수 없습니다."));
    if (contest.getStatus() != ContestStatus.PLANNED)
      return;
    long count = participantRepository.countByContestId(contestId);
    if (count < 2) {
      contest.setStatus(ContestStatus.END);
      return;
    }
    contest.setStatus(ContestStatus.RUNNING);

  }
}