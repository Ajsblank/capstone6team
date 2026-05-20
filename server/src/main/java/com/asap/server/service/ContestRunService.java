package com.asap.server.service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleParticipant;
import com.asap.server.domain.ContestSchedule;
import com.asap.server.global.type.ContestStatus;
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
  private final CodeBattleParticipantRepository participantRepository;
  private final TaskScheduler taskScheduler;
  private final Map<Long, ScheduledFuture<?>> scheduledTasks = new ConcurrentHashMap<>();
  private final Map<Long, List<ScheduledFuture<?>>> swissScheduledTasks = new ConcurrentHashMap<>();
  private final FullLeagueService fullLeagueService;
  private final ContestScheduleRepository contestScheduleRepository;
  private final SwissLeagueService swissLeagueService;

  @PostConstruct
  public void initContestSchedules() {
    List<CodeBattleContest> contests = contestRepository.findAll();
    log.info("[Scheduler] 전체 대회 개수: {}", contests.size());

    for (CodeBattleContest contest : contests) {

      if (!contest.getStartDate().isAfter(LocalDateTime.now())) {
        log.debug("[Scheduler] contestId={} 시작 시간이 이미 지났으므로 스킵합니다. 시작 시간: {}", contest.getId(), contest.getStartDate());
        continue;
      }
      if (contest.getStatus() != ContestStatus.PLANNED) {
        log.debug("[Scheduler] contestId={} PLANNED 상태가 아니므로 스킵합니다. 현재 상태: {}", contest.getId(), contest.getStatus());
        continue;
      }
      registerContest(contest);
    }
    log.info("[Scheduler] 초기화 완료. 스케줄된 대회 개수: {}", scheduledTasks.size());
  }

  public void registerContest(CodeBattleContest contest) {
    Long contestId = contest.getId();
    Runnable task = () -> processMatching(contestId);

    Instant startInstant = contest.getStartDate().atZone(ZoneId.of("Asia/Seoul")).toInstant();

    ScheduledFuture<?> scheduled = taskScheduler.schedule(task, triggerContext -> {
      if (triggerContext.lastCompletion() != null) {
        return null; // 1회 실행 후 종료
      }
      return startInstant;
    });

    if (scheduled != null) {
      scheduledTasks.put(contestId, scheduled);
    }
    log.info("[Scheduler] contestId={} 대회의 시작 시간이 등록되었습니다. 등록 시간={}", contestId, contest.getStartDate());

    // 중간 대회 일정 조회 → 스위스 세션 예약
    List<ContestSchedule> schedules = contestScheduleRepository.findByContestId(contestId);
    schedules.sort(Comparator.comparing(ContestSchedule::getScheduledAt));

    int sessionCount = 0;
    for (int i = 0; i < schedules.size(); i++) {
      // 예약 시점 확인
      LocalDateTime scheduledAt = schedules.get(i).getScheduledAt();
      if (!scheduledAt.isAfter(LocalDateTime.now())) {
        log.debug("[Scheduler] contestId={} 스위스 세션 {} 시간이 지나 스킵. 시간={}",
            contestId, i + 1, scheduledAt);
        continue;
      }
      sessionCount++;
      final int sessionIndex = sessionCount; // 세션 번호 (0-based → +1해서 저장)
      final Long scheduleId = schedules.get(i).getId();

      Runnable sessionTask = () -> swissLeagueService.processSwissSession(contestId, sessionIndex + 1, scheduleId);
      Instant sessionInstant = schedules.get(i).getScheduledAt()
          .atZone(ZoneId.of("Asia/Seoul")).toInstant();

      ScheduledFuture<?> sessionScheduled = taskScheduler.schedule(sessionTask, triggerContext -> {
        if (triggerContext.lastCompletion() != null)
          return null;
        return sessionInstant;
      });
      if (sessionScheduled != null) {
        swissScheduledTasks.computeIfAbsent(contestId, k -> new ArrayList<>()).add(sessionScheduled);
      }

      log.info("[Scheduler] contestId={} 스위스 세션 {} 예약 완료. 시작 시간={}",
          contestId, sessionIndex + 1, schedules.get(i).getScheduledAt());
    }
  }

  public void upsertContestSchedule(CodeBattleContest contest) {
    log.info("[Scheduler] contestId={} 스케줄 업데이트 시작", contest.getId());
    cancelContestSchedule(contest.getId());
    registerContest(contest);
    log.info("[Scheduler] contestId={} 스케줄 업데이트 완료", contest.getId());
  }

  public void cancelContestSchedule(Long contestId) {
    ScheduledFuture<?> future = scheduledTasks.remove(contestId);
    if (future != null) {
      future.cancel(false);
      log.info("[Scheduler] contestId={} 기존 스케줄을 취소했습니다.", contestId);
    } else {
      log.debug("[Scheduler] contestId={} 취소할 스케줄이 없습니다.", contestId);
    }
    // 스위스 세션 예약 일괄 취소
    List<ScheduledFuture<?>> swissFutures = swissScheduledTasks.remove(contestId);
    if (swissFutures != null && !swissFutures.isEmpty()) {
      swissFutures.forEach(f -> f.cancel(false));
      log.info("[Scheduler] contestId={} 스위스 세션 스케줄 {}개를 취소했습니다.", contestId, swissFutures.size());
    }
  }

  @Transactional
  private void processMatching(Long contestId) {
    try {
      CodeBattleContest contest = contestRepository.findById(contestId)
          .orElseThrow(() -> new IllegalArgumentException("대회를 찾을 수 없습니다. id=" + contestId));

      contest.setStatus(ContestStatus.RUNNING);
      contestRepository.save(contest);
      log.info("[Scheduler] contestId={} 대회를 RUNNING 상태로 시작합니다.", contestId);

      // 해당 대회의 참가자 목록 조회
      List<CodeBattleParticipant> participants = participantRepository.findByContestId(contestId);

      // 모든 참가자의 score를 0으로 초기화
      for (CodeBattleParticipant p : participants) {
        p.setScore(0);
      }
      // 초기화된 점수 DB 반영
      participantRepository.saveAll(participants);

      // 종료 예약
      Runnable task = () -> processEnd(contestId);
      Instant endInstant = contest.getEndDate().atZone(ZoneId.of("Asia/Seoul")).toInstant();
      log.info("대회 종료 시간: {}", contest.getEndDate());

      ScheduledFuture<?> endScheduled = taskScheduler.schedule(task, triggerContext -> {
        if (triggerContext.lastCompletion() != null) {
          return null; // 1회 실행 후 종료
        }
        return endInstant;
      });

      if (endScheduled != null) {
        scheduledTasks.put(contestId, endScheduled);
        log.info("[Scheduler] contestId={} 대회의 종료 시간이 등록되었습니다. 등록 시간={}", contestId, contest.getEndDate());
      }

    } catch (Exception e) {
      log.error("[Scheduler] contestId={} processMatching 실행 중 에러 발생", contestId, e);
    }
  }

  @Transactional
  private void processEnd(Long contestId) {
    try {
      CodeBattleContest contest = contestRepository.findById(contestId)
          .orElseThrow(() -> new IllegalArgumentException("대회를 찾을 수 없습니다. id=" + contestId));

      // 제출 전에 참가자/제출 수 검사
      long participantCount = participantRepository.countByContestId(contestId);
      long submissionCount = participantRepository.findByContestIdAndSubmissionIsNotNull(contestId).size();
      // 참가자 2명 미만 이거나 제출이 2개 미만이면 grading 종료
      if (participantCount < 2 || submissionCount < 2) {
        contest.setStatus(ContestStatus.CANCELED);
        log.warn("참가자/제출 부족으로 grading을 스킵합니다. participantCount: {}, submissionCount: {}\n대회 상태 = {}", participantCount,
            submissionCount, ContestStatus.CANCELED);
        return;
      }
      contest.setStatus(ContestStatus.END);
      contestRepository.save(contest);
      log.info("대회 종료 시간 도달로 상태를 END로 변경했습니다. contestId: {}", contestId);

      // Grading 실행
      log.info("최종 Grading을 실행합니다. contestId: {}", contestId);
      fullLeagueService.fullLeagueGrading(contestId);

    } finally {
      scheduledTasks.remove(contestId);
      swissScheduledTasks.remove(contestId); // 남아있는 스케줄 정리
      log.debug("[Scheduler] contestId={} 종료 스케줄을 제거했습니다.", contestId);
    }
  }

}