package com.asap.server.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.data.redis.core.StringRedisTemplate;
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

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class SwissLeagueService {
  private final CodeBattleContestRepository contestRepository;
  private final CodeBattleParticipantRepository participantRepository;
  private final ContestScheduleRepository contestScheduleRepository;
  private final ContestSwissSessionRepository swissSessionRepository;
  private final ContestSwissRoundRepository swissRoundRepository;
  private final ContestSwissMatchRepository swissMatchRepository;
  private final ObjectMapper objectMapper;

  private final StringRedisTemplate redisTemplate;
  private static final String CODE_BATTLE_SWISS_LEAGUE_QUEUE_KEY = "code_battle_swiss_league_queue";

  private final S3Service s3Service;
  private final SseService sseService;

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

    ObjectNode rootNode = objectMapper.createObjectNode();
    rootNode.put("submissionId", matchId);
    rootNode.put("timeLimitSec", contest.getTimeLimitSec());
    rootNode.put("memoryLimitMb", contest.getMemoryLimitMB());
    rootNode.put("aiOrder", aiOrder);
    ObjectNode codesNode = rootNode.putObject("codes");
    codesNode.put("judge", judgeCode);
    codesNode.put("player1", player1Code);
    codesNode.put("player2", player2Code);
    ObjectNode languagesNode = rootNode.putObject("languages");
    languagesNode.put("judge", "cpp");
    languagesNode.put("language1", s1.getLanguage().name());
    languagesNode.put("language2", s2.getLanguage().name());

    String payload = objectMapper.writeValueAsString(rootNode);
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
