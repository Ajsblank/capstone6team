package com.asap.server.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleParticipant;
import com.asap.server.domain.ContestSwissRound;
import com.asap.server.domain.ContestSwissSession;
import com.asap.server.global.type.ContestStatus;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.CodeBattleParticipantRepository;
import com.asap.server.repository.ContestSwissRoundRepository;
import com.asap.server.repository.ContestSwissSessionRepository;

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
  private final SwissLeagueService swissLeagueService;
  private final StringRedisTemplate redisTemplate;
  private final ContestSwissRoundRepository roundRepository;
  private final ContestSwissSessionRepository sessionRepository;

  @Autowired
  @Lazy
  private ContestRunService self;

  // 서버 실행 시 대회 예약
  @PostConstruct
  public void initContestSchedules() {
    List<CodeBattleContest> contests = contestRepository.findAll();
    log.info("[Scheduler] 전체 대회 개수: {}", contests.size());
    LocalDateTime now = LocalDateTime.now(ZoneId.of("Asia/Seoul"));
    for (CodeBattleContest contest : contests) {
      if (contest.getStatus() == ContestStatus.END || contest.getStatus() == ContestStatus.CANCELED) {
        log.debug("종료/취소된 대회 이므로 스킵 contestId={}", contest.getId());
        continue;
      }
      // 시작 처리가 안된 부분
      if (contest.getStartDate() == null) {
        log.warn("[Scheduler] startDate가 null인 대회 스킵 contestId={}", contest.getId());
        continue;
      }
      if (contest.getStartDate().isBefore(now)) {
        if (contest.getStatus() == ContestStatus.PLANNED) {

          self.processMatching(contest.getId());
          log.info("시작 처리가 안된 대회, 대회 Id={} 처리 완료", contest.getId());
          continue;
        }
        // 키 정리 필요한 부분 찾기
        else if (contest.getStatus() == ContestStatus.RUNNING) {
          if (contest.getEndDate().isBefore(now)) {
            // 즉시 종료
            self.processEnd(contest.getId());
            log.info("종료일 지난 RUNNING 대회 즉시 종료 처리. contestId={}", contest.getId());
          } else {
            // 예약 종료
            self.processMatching(contest.getId());
            log.info("서버 재시작으로 끊긴 RUNNING 대회 종료 재예약. contestId={}", contest.getId());
          }
          continue;
        }
        log.info("비정상 상태, 확인 필요 대회 id={} #1", contest.getId());
        continue;
      }
      if (contest.getStatus() != ContestStatus.PLANNED) {
        log.info("비정상 상태, 확인 필요 대회 id={} status={}", contest.getId(), contest.getStatus());
        continue;
      }
      // 정상 대회 시작 예약
      registerContest(contest);
    }
    log.info("[Scheduler] 초기화 완료. 스케줄된 대회 개수: {}", scheduledTasks.size());
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void initSwissContest(Long contestId) {
    // afterCommit 이후 엔티티는 detach 상태이므로 새 트랜잭션 안에서 직접 조회
    CodeBattleContest contest = contestRepository.findById(contestId)
        .orElseThrow(() -> new IllegalArgumentException("대회를 찾을 수 없습니다. id=" + contestId));
    if (contest.getStartDate() == null || contest.getEndDate() == null) {
      log.info("[Scheduler] contestId={} startDate 또는 endDate가 없어 스위스 세션을 생성하지 않습니다.", contestId);
      return;
    }
    LocalDateTime now = LocalDateTime.now(ZoneId.of("Asia/Seoul"));
    List<ContestSwissSession> sessions = new ArrayList<>();
    LocalDate cur = contest.getStartDate().toLocalDate();
    LocalDate end = contest.getEndDate().toLocalDate();
    int sessionNumber = 1;

    while (!cur.isAfter(end)) {
      LocalDateTime scheduledAt = cur.atTime(15, 0);
      if (scheduledAt.isBefore(contest.getEndDate()) && scheduledAt.isAfter(now)) {
        ContestSwissSession session = new ContestSwissSession();
        session.setContest(contest);
        session.setScheduledAt(scheduledAt);
        session.setStatus(ContestStatus.PLANNED);
        session.setSessionNumber(sessionNumber++);
        sessions.add(session);
      }
      cur = cur.plusDays(1);
    }

    if (!sessions.isEmpty()) {
      sessionRepository.saveAll(sessions);
      log.info("[Scheduler] contestId={} 스위스 세션 {}개 생성 완료", contestId, sessions.size());
    } else {
      log.info("[Scheduler] contestId={} 생성할 스위스 세션 없음", contestId);
    }
  }

  public void registerContest(CodeBattleContest contest) {
    Long contestId = contest.getId();
    Runnable task = () -> self.processMatching(contestId);

    Instant startInstant = contest.getStartDate().atZone(ZoneId.of("Asia/Seoul")).toInstant();

    ScheduledFuture<?> scheduled = taskScheduler.schedule(task, triggerContext -> {
      if (triggerContext.lastCompletion() != null) {
        log.info("이미 실행된 대회 오류 #2 contestId={}", contest.getId());
        return null; // 1회 실행 후 종료
      }
      return startInstant;
    });

    if (scheduled != null) {
      scheduledTasks.put(contestId, scheduled);
    }
    log.info("[Scheduler] contestId={} 대회의 시작 시간이 등록되었습니다. 등록 시간={}", contestId, contest.getStartDate());
    // 스위스 리그도 예약
    List<ContestSwissSession> plannedSessions = sessionRepository
        .findByContestIdAndStatus(contestId, ContestStatus.PLANNED);
    for (ContestSwissSession session : plannedSessions) {
      registSwissContest(contest, session);
    }
  }

  public void registSwissContest(CodeBattleContest contest, ContestSwissSession session) {
    Long contestId = contest.getId();
    // 중간 대회 일정 조회 → 스위스 세션 예약
    LocalDateTime scheduledAt = session.getScheduledAt();
    LocalDateTime now = LocalDateTime.now(ZoneId.of("Asia/Seoul"));
    Long sessionId = session.getId();
    // 종료 세션 즉시 스킵
    if (session.getStatus() == ContestStatus.END) {
      log.info("종료된 세션 스킵 세션 ID = {}", sessionId);
      return;
    }
    // 진행 중 세션 처리
    else if (session.getStatus() == ContestStatus.RUNNING) {
      // 임시로 모든 라운드 초기화 및 새로 세션 시작
      redisTemplate.delete("swiss:session:" + sessionId + ":total");
      redisTemplate.delete("swiss:session:" + sessionId + ":done");
      // 모든 라운드 키 초기화
      List<ContestSwissRound> rounds = roundRepository.findBySessionId(sessionId);
      for (ContestSwissRound round : rounds) {
        redisTemplate.delete("swiss:round:" + round.getId() + ":total");
        redisTemplate.delete("swiss:round:" + round.getId() + ":done");
        redisTemplate.delete("swiss:round:" + round.getId() + ":matchIds");
      }
      swissLeagueService.generateSwissSession(contestId, sessionId);
      log.info("[Scheduler] 시작 안된 스위스 세션 즉시 다시 실행.(임시 방편) contestId={} sessionId={}", contestId, session.getId());
      return;
    } else if (session.getStatus() != ContestStatus.PLANNED) {
      log.info("비정상 상태이므로 스킵합니다. sessionId={}, Status={}", sessionId, session.getStatus());
      return;
    }
    if (scheduledAt.isBefore(now)) {
      // 시작처리 안된 세션 실행 (현재 세션 중복 검사 없음)
      swissLeagueService.generateSwissSession(contestId, session.getId());
      log.info("[Scheduler] 시작 안된 스위스 세션 즉시 실행. contestId={} sessionId={}", contestId, session.getId());
      return;
    }

    Runnable sessionTask = () -> swissLeagueService.generateSwissSession(contestId, session.getId());
    Instant sessionInstant = scheduledAt
        .atZone(ZoneId.of("Asia/Seoul")).toInstant();

    ScheduledFuture<?> sessionScheduled = taskScheduler.schedule(sessionTask, triggerContext -> {
      if (triggerContext.lastCompletion() != null)
        return null;
      return sessionInstant;
    });
    // 예약이 없으면 넣음
    if (sessionScheduled != null) {
      swissScheduledTasks.computeIfAbsent(contestId, k -> new ArrayList<>()).add(sessionScheduled);
    }
    log.info("[Scheduler] contestId={} 스위스 세션 {} 예약 완료. 시작 시간={}",
        contestId, session.getSessionNumber(), session.getScheduledAt());
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
    } else {
      log.debug("[Scheduler] contestId={} 취소할 스위스 스케줄이 없습니다.", contestId);
    }
  }

  @Transactional
  public void processMatching(Long contestId) {
    try {
      CodeBattleContest contest = contestRepository.findById(contestId)
          .orElseThrow(() -> new IllegalArgumentException("대회를 찾을 수 없습니다. id=" + contestId));

      contest.setStatus(ContestStatus.RUNNING);
      contestRepository.save(contest);
      log.info("[Scheduler] contestId={} 대회를 RUNNING 상태로 시작합니다.", contestId);

      // 종료 예약
      Runnable task = () -> self.processEnd(contestId);
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
  public void processEnd(Long contestId) {
    try {
      CodeBattleContest contest = contestRepository.findById(contestId)
          .orElseThrow(() -> new IllegalArgumentException("대회를 찾을 수 없습니다. id=" + contestId));

      // 제출 전에 참가자/제출 수 검사
      long participantCount = participantRepository.countByContestId(contestId);
      long submissionCount = participantRepository.findByContestIdAndSubmissionIsNotNull(contestId).size();
      // 참가자 2명 미만 이거나 제출이 2개 미만이면 grading 종료
      if (participantCount < 2 || submissionCount < 2) {
        contest.setStatus(ContestStatus.CANCELED);
        contestRepository.save(contest);
        log.warn("참가자/제출 부족으로 grading을 스킵합니다. participantCount: {}, submissionCount: {}\n대회 상태 = {}", participantCount,
            submissionCount, ContestStatus.CANCELED);
        return;
      }
      contest.setStatus(ContestStatus.END);
      contestRepository.save(contest);
      log.info("대회 종료 시간 도달로 상태를 END로 변경했습니다. contestId: {}", contestId);

      // 해당 대회의 참가자 목록 조회
      List<CodeBattleParticipant> participants = participantRepository.findByContestId(contestId);

      // 모든 참가자의 score를 0으로 초기화
      for (CodeBattleParticipant p : participants) {
        p.setScore(0);
      }
      // 초기화된 점수 DB 반영
      participantRepository.saveAll(participants);

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