package com.asap.server.service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;
import java.util.stream.Collectors;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleParticipant;
import com.asap.server.domain.CodeBattleSubmission;
import com.asap.server.domain.ContestSchedule;
import com.asap.server.domain.ContestSwissMatch;
import com.asap.server.domain.ContestSwissRound;
import com.asap.server.domain.ContestSwissSession;
import com.asap.server.global.type.ContestStatus;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.CodeBattleParticipantRepository;
import com.asap.server.repository.ContestScheduleRepository;
import com.asap.server.repository.ContestSwissMatchRepository;
import com.asap.server.repository.ContestSwissRoundRepository;
import com.asap.server.repository.ContestSwissSessionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

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
  private final FullLeagueService swissMatchMaker;
  private final ContestScheduleRepository contestScheduleRepository;
  private final ContestSwissSessionRepository swissSessionRepository;
  private final ContestSwissRoundRepository swissRoundRepository;
  private final ContestSwissMatchRepository swissMatchRepository;
  private final ObjectMapper objectMapper;

  private final StringRedisTemplate redisTemplate;
  private static final String CODE_BATTLE_GRADING_QUEUE_KEY = "code_battle_grading_queue";
  private static final String CODE_BATTLE_SWISS_LEAGUE_QUEUE_KEY = "code_battle_swiss_league_queue";

  private final S3Service s3Service;
  private final SseService sseService;

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

      Runnable sessionTask = () -> processSwissSession(contestId, sessionIndex + 1, scheduleId);
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
      swissMatchMaker.fullLeagueGrading(contestId);

    } finally {
      scheduledTasks.remove(contestId);
      swissScheduledTasks.remove(contestId); // 남아있는 스케줄 정리
      log.debug("[Scheduler] contestId={} 종료 스케줄을 제거했습니다.", contestId);
    }
  }

  @Transactional
  public void processSwissSession(Long contestId, int sessionNumber, Long scheduleId) {
    try {
      CodeBattleContest contest = contestRepository.findById(contestId)
          .orElseThrow(() -> new IllegalArgumentException("대회를 찾을 수 없습니다. id=" + contestId));
      if (contest.getStatus() != ContestStatus.RUNNING) {
        log.info("[SwissScheduler] contestId={} 대회가 RUNNING 상태가 아니므로 세션 {} 스킵. 현재={}",
            contestId, sessionNumber, contest.getStatus());
        return;
      }
      log.info("[SwissScheduler] contestId={} 세션 {} 시작", contestId, sessionNumber);

      // 1. 세션 엔티티 생성
      ContestSwissSession session = new ContestSwissSession();
      session.setContest(contest);
      session.setSessionNumber(sessionNumber);
      session.setStartedAt(LocalDateTime.now());
      session = swissSessionRepository.save(session);

      // 2. ContestSchedule 상태 업데이트 (PLANNED → RUNNING)
      ContestSchedule schedule = contestScheduleRepository.findById(scheduleId)
          .orElseThrow(() -> new IllegalArgumentException("일정을 찾을 수 없습니다. id=" + scheduleId));
      schedule.setStatus(ContestStatus.RUNNING);
      contestScheduleRepository.save(schedule);

      // 3. 스위스 매칭 실행 (generateSwissRound 호출)
      generateSwissRound(contestId, session);

      log.info("[SwissScheduler] contestId={} 세션 {} 매칭 완료", contestId, sessionNumber);

    } catch (Exception e) {
      log.error("[SwissScheduler] contestId={} 세션 {} 처리 중 오류 발생", contestId, sessionNumber, e);
    }
  }

  @Transactional
  private void generateSwissRound(Long contestId, ContestSwissSession session) {
    List<CodeBattleParticipant> participants = participantRepository
        .findByContestIdAndSubmissionIsNotNull(contestId);

    int matchesPerRound = participants.size() / 2;
    if (matchesPerRound == 0) {
      log.warn("[SwissScheduler] contestId={} 참가자 부족으로 매칭 생성 불가", contestId);
      return;
    }

    // 점수순 내림차순 정렬
    participants.sort(Comparator.comparingInt(
        (CodeBattleParticipant p) -> p.getScore() == null ? 0 : p.getScore()).reversed());

    // 라운드 엔티티 생성
    ContestSwissRound round = new ContestSwissRound();
    round.setSession(session);
    round.setRoundNumber(1); // 세션당 라운드 번호, 필요 시 확장
    round.setStatus("RUNNING");
    round.setStartedAt(LocalDateTime.now());
    round = swissRoundRepository.save(round);

    CodeBattleContest contest = session.getContest();
    Map<Long, CodeBattleParticipant> participantMap = participants.stream()
        .collect(Collectors.toMap(p -> p.getUser().getId(), p -> p));

    List<ContestSwissMatch> matches = new ArrayList<>();
    int enqueued = 0;

    // Redis 카운터 초기화
    int expected = participants.size() / 2;
    redisTemplate.opsForValue().set("swiss:total:" + session.getId(), String.valueOf(expected));
    redisTemplate.opsForValue().set("swiss:done:" + session.getId(), "0");

    for (int i = 0; i < participants.size() - 1; i += 2) {
      CodeBattleParticipant p1 = participants.get(i);
      CodeBattleParticipant p2 = participants.get(i + 1);

      ContestSwissMatch match = new ContestSwissMatch();
      match.setRound(round);
      match.setUser1(p1.getUser());
      match.setUser2(p2.getUser());
      match.setCreatedAt(LocalDateTime.now());
      ContestSwissMatch savedMatch = swissMatchRepository.save(match);
      matches.add(savedMatch);

      // Redis matchIds 누적
      redisTemplate.opsForList().leftPush(
          "swiss:matchIds:" + session.getId(), String.valueOf(savedMatch.getId()));

      try {
        enqueueSwissMatchToGradingQueue(
            savedMatch.getId(),
            contest,
            participantMap.get(p1.getUser().getId()).getSubmission(),
            participantMap.get(p2.getUser().getId()).getSubmission(),
            0);
        enqueued++;
      } catch (Exception e) {
        log.error("[SwissScheduler] matchId={} 큐 적재 실패", savedMatch.getId(), e);
        redisTemplate.delete("swiss:total:" + session.getId());
        redisTemplate.delete("swiss:done:" + session.getId());
        throw new RuntimeException("스위스 큐 적재 실패", e);
      }
    }

    log.info("[SwissScheduler] sessionId={} expected={}, enqueued={}", session.getId(), expected, enqueued);
  }

  private void enqueueSwissMatchToGradingQueue(
      Long matchId,
      CodeBattleContest contest,
      CodeBattleSubmission s1,
      CodeBattleSubmission s2,
      int aiOrder) throws Exception {

    String judgeCode = contest.getJudgeCode();
    String player1Code = s1.getCodeUrl();
    String player2Code = s2.getCodeUrl();

    ObjectNode root = objectMapper.createObjectNode();
    root.put("submissionId", matchId);
    root.put("language1", s1.getLanguage().name());
    root.put("language2", s2.getLanguage().name());
    root.put("aiOrder", aiOrder);
    root.put("timeLimitSec", contest.getTimeLimitSec());
    root.put("memoryLimitMb", contest.getMemoryLimitMB());

    ObjectNode codes = root.putObject("codes");
    codes.put("judge", judgeCode);
    codes.put("player1", player1Code);
    codes.put("player2", player2Code);

    String payload = objectMapper.writeValueAsString(root);
    Long queueSize = redisTemplate.opsForList().leftPush(CODE_BATTLE_SWISS_LEAGUE_QUEUE_KEY, payload);

    log.info("[SwissScheduler] 큐 적재 완료. matchId={}, queueSize={}", matchId, queueSize);
  }

  public void aggregateSwissSession(Long sessionId) {
    log.info("[Swiss] sessionId={} 집계 시작", sessionId);

    try {
      List<String> matchIdStrs = redisTemplate.opsForList()
          .range("swiss:matchIds:" + sessionId, 0, -1);
      List<Long> matchIds = matchIdStrs.stream().map(Long::parseLong).collect(Collectors.toList());

      List<ContestSwissMatch> allMatches = swissMatchRepository.findAllById(matchIds);

      Map<Long, Integer> winsMap = new HashMap<>();
      Map<Long, Integer> drawsMap = new HashMap<>();
      Map<Long, Integer> lossesMap = new HashMap<>();
      Map<Long, List<Long>> userMatchIds = new HashMap<>();
      Map<Long, List<Long>> opponentsMap = new HashMap<>();

      for (ContestSwissMatch m : allMatches) {
        Long u1 = m.getUser1().getId();
        Long u2 = m.getUser2().getId();

        userMatchIds.computeIfAbsent(u1, k -> new ArrayList<>()).add(m.getId());
        userMatchIds.computeIfAbsent(u2, k -> new ArrayList<>()).add(m.getId());
        opponentsMap.computeIfAbsent(u1, k -> new ArrayList<>()).add(u2);
        opponentsMap.computeIfAbsent(u2, k -> new ArrayList<>()).add(u1);

        if ("WIN1".equals(m.getResult() != null ? m.getResult() : "")) {
          winsMap.merge(u1, 1, Integer::sum);
          lossesMap.merge(u2, 1, Integer::sum);
        } else if ("WIN2".equals(m.getResult() != null ? m.getResult() : "")) {
          winsMap.merge(u2, 1, Integer::sum);
          lossesMap.merge(u1, 1, Integer::sum);
        } else if ("DRAW".equals(m.getResult() != null ? m.getResult() : "")) {
          drawsMap.merge(u1, 1, Integer::sum);
          drawsMap.merge(u2, 1, Integer::sum);
        }
      }

      // 세션 소속 contestId 조회
      ContestSwissSession session = swissSessionRepository.findById(sessionId)
          .orElseThrow(() -> new IllegalArgumentException("세션을 찾을 수 없습니다. id=" + sessionId));
      Long contestId = session.getContest().getId();

      // 제출 시간 맵
      Map<Long, LocalDateTime> submissionTimeMap = new HashMap<>();
      participantRepository.findByContestId(contestId).forEach(p -> {
        if (p.getSubmission() != null && p.getSubmission().getCreatedAt() != null) {
          submissionTimeMap.put(p.getUser().getId(), p.getSubmission().getCreatedAt());
        }
      });

      List<Long> userIds = new ArrayList<>(userMatchIds.keySet());
      userIds.sort((a, b) -> {
        double pa = winsMap.getOrDefault(a, 0) * 1.0 + drawsMap.getOrDefault(a, 0) * 0.5;
        double pb = winsMap.getOrDefault(b, 0) * 1.0 + drawsMap.getOrDefault(b, 0) * 0.5;
        int cmp = Double.compare(pb, pa);
        if (cmp != 0)
          return cmp;
        LocalDateTime ta = submissionTimeMap.getOrDefault(a, LocalDateTime.MAX);
        LocalDateTime tb = submissionTimeMap.getOrDefault(b, LocalDateTime.MAX);
        return ta.compareTo(tb);
      });

      List<Map<String, Object>> standings = new ArrayList<>();
      for (int i = 0; i < userIds.size(); i++) {
        Long userId = userIds.get(i);
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("user_id", userId);
        s.put("wins", winsMap.getOrDefault(userId, 0));
        s.put("draws", drawsMap.getOrDefault(userId, 0));
        s.put("losses", lossesMap.getOrDefault(userId, 0));
        s.put("points", winsMap.getOrDefault(userId, 0) * 1.0 + drawsMap.getOrDefault(userId, 0) * 0.5);
        s.put("rank", i + 1);
        s.put("opponents", opponentsMap.getOrDefault(userId, List.of()));
        s.put("match_ids", userMatchIds.getOrDefault(userId, List.of()));
        standings.add(s);
      }

      Map<String, Object> result = new LinkedHashMap<>();
      result.put("total_participants", userIds.size());
      result.put("final_standings", standings);
      String json = objectMapper.writeValueAsString(result);

      // S3 저장: contest-resource/{contestId}/swiss-result/{sessionId}
      String key = String.format("backend-deploy/contest-resource/%d/swiss-result/%d", contestId, sessionId);
      s3Service.uploadJsonResult(key, json);
      log.info("[Swiss] sessionId={} S3 저장 완료. key={}", sessionId, key);

      // 세션 완료 처리
      session.setFinishedAt(LocalDateTime.now());
      swissSessionRepository.save(session);

      // SSE 전송
      for (Long userId : userIds) {
        sseService.sendToUser(userId, json, "swiss-session-end");
      }

    } catch (Exception e) {
      log.error("[Swiss] sessionId={} 집계 실패", sessionId, e);
    } finally {
      redisTemplate.delete("swiss:total:" + sessionId);
      redisTemplate.delete("swiss:done:" + sessionId);
      redisTemplate.delete("swiss:matchIds:" + sessionId);
      log.info("[Swiss] sessionId={} Redis 키 정리 완료", sessionId);
    }
  }
}