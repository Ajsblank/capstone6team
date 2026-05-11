package com.asap.server.service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleContest.ContestStatus;
import com.asap.server.domain.CodeBattleParticipant;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.CodeBattleParticipantRepository;
import com.asap.server.repository.ContestScheduleRepository;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class ContestRunService {
  private final CodeBattleContestRepository contestRepository;
  private final ContestScheduleRepository contestScheduleRepository;
  private final CodeBattleParticipantRepository participantRepository;
  private final TaskScheduler taskScheduler;
  private final Map<Long, ScheduledFuture<?>> scheduledTasks = new ConcurrentHashMap<>();

  @PostConstruct
  public void initContestSchedules() {
    List<CodeBattleContest> contests = contestRepository.findAll();

    for (CodeBattleContest contest : contests) {

      if (contest.getStatus() != ContestStatus.PLANNED)
        continue;

      if (!contest.getStartDate().isAfter(LocalDateTime.now())) {
        continue;
      }
      registerContest(contest);
    }
  }

  private void registerContest(CodeBattleContest contest) {
    Runnable task = () -> processMatching(contest.getId());

    Instant startInstant = contest.getStartDate().atZone(ZoneId.of("Asia/Seoul")).toInstant();

    taskScheduler.schedule(task, triggerContext -> {
      if (triggerContext.lastCompletion() != null) {
        return null; // 1회 실행 후 종료
      }
      return startInstant;
    });
    log.info("[Scheduler] contestId={} 대회의 시작 시간이 등록되었습니다. 등록 시간={}", contest.getId(), contest.getStartDate());
  }

  @Transactional
  private void processMatching(Long contestId) {
    if (count < 2) {
      // Cancled 상태를 End 로 사용중
      contest.setStatus(ContestStatus.END);
      return;
    }
    log.info("[Scheduler] 대회 ID {} 의 매칭을 시작합니다.", contestId);

    try {
      // 해당 대회의 참가자 목록 조회
      List<CodeBattleParticipant> participants = participantRepository.findByContestId(contestId);

      // 모든 참가자의 score를 0으로 초기화
      for (CodeBattleParticipant p : participants) {
        p.setScore(0);
      }
      participantRepository.saveAll(participants); // 초기화된 점수 DB 반영

      // 스위스 매칭 다음 라운드 생성 로직 호출
      // swissMatchMaker.generateNextRound(contestId);
      // swissMatchMaker.

    } catch (Exception e) {
      log.error("[Scheduler] 에러 발생", e);
    } finally {
      scheduledTasks.remove(contestId);
    }
  }
  // private void registerContest(CodeBattleContest contest) {
  // long count = participantRepository.countByContestId(contest.getId());

  // List<ContestSchedule> schedules =
  // contestScheduleRepository.findByContest_Id(contest.getId());
  // for (ContestSchedule schedule : schedules) {
  // LocalDateTime startTime = schedule.getScheduledAt();
  // Runnable task = () -> processMatching(contest.getId());

  // taskScheduler.schedule(task,
  // triggerContext -> startTime.atZone(ZoneId.of("Asia/Seoul")).toInstant());
  // log.info("[Scheduler] contestId={} 스케줄이 등록되었습니다. 등록 시간={}", contest.getId(),
  // startTime);
  // }
  // }
}