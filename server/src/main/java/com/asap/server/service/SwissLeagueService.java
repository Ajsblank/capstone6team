package com.asap.server.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleParticipant;
import com.asap.server.domain.CodeBattleSubmission;
import com.asap.server.domain.ContestSwissMatch;
import com.asap.server.domain.ContestSwissRound;
import com.asap.server.domain.ContestSwissSession;
import com.asap.server.dto.response.CodeBattleMatchResult;
import com.asap.server.global.type.ContestStatus;
import com.asap.server.global.type.MatchStatus;
import com.asap.server.global.type.ResultType;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.CodeBattleParticipantRepository;
import com.asap.server.repository.ContestSwissMatchRepository;
import com.asap.server.repository.ContestSwissRoundRepository;
import com.asap.server.repository.ContestSwissSessionRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class SwissLeagueService {
  private final CodeBattleContestRepository contestRepository;
  private final CodeBattleParticipantRepository participantRepository;
  private final ContestSwissSessionRepository swissSessionRepository;
  private final ContestSwissRoundRepository swissRoundRepository;
  private final ContestSwissMatchRepository swissMatchRepository;
  private final ObjectMapper objectMapper;

  private final StringRedisTemplate redisTemplate;
  private static final String CODE_BATTLE_SWISS_LEAGUE_QUEUE_KEY = "code_battle_swiss_league_queue";

  private final S3Service s3Service;
  private final SseService sseService;
  private final String swissRound = "swiss:round:";
  private final String totalKey = ":total";
  private final String doneKey = ":done";
  private final String matchKey = ":matchIds";

  @Transactional
  public void generateSwissSession(Long contestId, int sessionNumber, Long sessionId) {
    try {
      CodeBattleContest contest = contestRepository.findById(contestId)
          .orElseThrow(() -> new IllegalArgumentException("대회를 찾을 수 없습니다. id=" + contestId));

      if (contest.getStatus() != ContestStatus.RUNNING) {
        log.info("[스위스리그] contestId={} 대회가 RUNNING 상태가 아니므로 세션 {} 스킵. 현재={}",
            contestId, sessionNumber, contest.getStatus());
        return;
      }
      log.info("[스위스리그] contestId={} 세션 {} 시작", contestId, sessionNumber);

      // 1. 세션 값 초기화
      ContestSwissSession session = swissSessionRepository.findById(sessionId)
          .orElseThrow(() -> new EntityNotFoundException("Session not found"));
      if (session.getStatus() == ContestStatus.END) {
        log.info("이미 종료된 세션이므로 스킵합니다.");
        return;
      }
      // 비정상 종료 라운드 무시 로직
      List<ContestSwissRound> runningRounds = swissRoundRepository
          .findBySessionIdAndStatus(sessionId, MatchStatus.RUNNING);
      for (ContestSwissRound stale : runningRounds) {
        stale.setStatus(MatchStatus.CANCELED);
        swissRoundRepository.save(stale);

        // Redis 키 정리 (존재 시)
        redisTemplate.delete(swissRound + stale.getId() + totalKey);
        redisTemplate.delete(swissRound + stale.getId() + doneKey);
        redisTemplate.delete(swissRound + stale.getId() + matchKey);
        log.warn("[스위스리그] sessionId={} roundId={} RUNNING → CANCELLED, Redis 정리",
            sessionId, stale.getId());
      }
      session.setSessionNumber(sessionNumber);
      if (session.getStartedAt() == null) {
        session.setStartedAt(LocalDateTime.now());
      }
      session.setStatus(ContestStatus.RUNNING);
      session = swissSessionRepository.save(session);

      List<CodeBattleParticipant> participants = participantRepository
          .findByContestIdAndSubmissionIsNotNull(contestId)
          .stream()
          .filter(p -> {
            CodeBattleSubmission s = p.getSubmission();
            if (s.getLanguage() == null) {
              log.warn("[스위스리그] submission ID {}의 language가 null, 스킵", s.getId());
              return false;
            }
            if (s.getCodeUrl() == null) {
              log.warn("[스위스리그] submission ID {}의 codeUrl가 null, 스킵", s.getId());
              return false;
            }
            return true;
          })
          .collect(Collectors.toList());

      // 참가자(제출 포함) 없음 예외 종료 처리
      if (participants.isEmpty()) {
        session.setStatus(ContestStatus.END);
        session.setFinishedAt(LocalDateTime.now());
        swissSessionRepository.save(session);
        log.warn("[스위스리그] contestId={} session={} 현재 정상 제출이 없으므로 세션이 종료됩니다.",
            contestId, sessionNumber);
        return;
      }

      // 모든 참가자의 score를 0으로 초기화
      for (CodeBattleParticipant p : participants) {
        p.setScore(0);
      }
      participantRepository.saveAll(participants);

      int roundsPerSession;
      int size = participants.size();
      if (size < 1) {
        log.error("[스위스리그] contestId={} sessionId={} 라운드 계산 오류", contestId, sessionId);
        return;
      } else {
        int log2Ceil = size <= 1 ? 0 : 32 - Integer.numberOfLeadingZeros(size - 1);
        roundsPerSession = log2Ceil + 1;
      }

      // sse 초기 상태 구성 및 전송
      Map<String, Object> sessionState = new LinkedHashMap<>();
      sessionState.put("session_number", sessionNumber);
      sessionState.put("status", "RUNNING");
      sessionState.put("total_rounds", roundsPerSession);
      sessionState.put("rounds", new ArrayList<>());
      sseService.updateSessionState(contestId, session.getId(), sessionState);

      // FINISHED 라운드 넘버 수집 (1~n 순서대로 확인)
      List<ContestSwissRound> finishedRounds = swissRoundRepository
          .findBySessionIdAndStatus(sessionId, MatchStatus.FINISHED);
      Set<Integer> finishedRoundNumbers = finishedRounds.stream()
          .map(ContestSwissRound::getRoundNumber)
          .collect(Collectors.toSet());

      // 1번부터 순서대로 체크해서 첫 번째 미완료 라운드 찾기
      int nextRound = 1;
      for (int i = 1; i <= roundsPerSession; i++) {
        if (finishedRoundNumbers.contains(i)) {
          nextRound = i + 1;
        } else {
          nextRound = i;
          break;
        }
      }
      redisTemplate.opsForValue().set("swiss:session:" + session.getId() + totalKey, String.valueOf(roundsPerSession));
      redisTemplate.opsForValue().set("swiss:session:" + session.getId() + doneKey,
          String.valueOf(finishedRoundNumbers.size()));

      if (nextRound > roundsPerSession) {
        log.info("[스위스리그] sessionId={} 모든 라운드 이미 완료 → 세션 집계", sessionId);
        aggregateSwissSession(sessionId);
        return;
      }

      generateSwissRound(contest, session, participants, nextRound);
      log.info("[스위스리그] contestId={} session={} 시작 완료", contestId, sessionNumber);

    } catch (Exception e) {
      log.error("[스위스리그] contestId={} session={} 시작 중 오류 발생", contestId, sessionNumber, e);
    }
  }

  @Transactional
  public void generateSwissRound(CodeBattleContest contest, ContestSwissSession session,
      List<CodeBattleParticipant> participants, int roundNumber) {
    // 참가자 셔플
    Collections.shuffle(participants);
    // 점수순 내림차순 정렬
    participants.sort(Comparator.comparingInt(
        (CodeBattleParticipant p) -> p.getScore() == null ? 0 : p.getScore()).reversed());

    // 라운드 엔티티 생성
    ContestSwissRound round = new ContestSwissRound();
    round.setSession(session);
    round.setRoundNumber(roundNumber);
    round.setStatus(MatchStatus.RUNNING);
    round.setStartedAt(LocalDateTime.now());
    round = swissRoundRepository.save(round);

    int matchsPerRound = participants.size() / 2;
    if (participants.size() % 2 == 1)
      matchsPerRound++;

    // 라운드 상태 초기화 및 rounds 리스트에 추가 후 전송
    Map<String, Object> roundState = new LinkedHashMap<>();
    roundState.put("round_number", roundNumber);
    roundState.put("status", "RUNNING");
    roundState.put("matches", new ArrayList<>());
    sseService.addRound(contest.getId(), session.getId(), roundState);
    // 라운드 Redis 초기화 - total을 마지막에 세팅 (경합 방지)
    redisTemplate.opsForValue().set(swissRound + round.getId() + totalKey, String.valueOf(matchsPerRound));
    redisTemplate.opsForValue().set(swissRound + round.getId() + doneKey, "0");
    int matchCount = 0;
    for (int j = 0; j + 1 < participants.size(); j += 2) {
      CodeBattleParticipant p1 = participants.get(j);
      CodeBattleParticipant p2 = participants.get(j + 1);
      ContestSwissMatch match = new ContestSwissMatch();
      match.setRound(round);
      match.setUser1(p1.getUser());
      match.setUser2(p2.getUser());
      ContestSwissMatch savedMatch = swissMatchRepository.save(match);

      // 매치 생성 시 matches에 추가 (결과는 null)
      Map<String, Object> matchInfo = new LinkedHashMap<>();
      matchInfo.put("match_id", savedMatch.getId());
      matchInfo.put("user1_id", p1.getUser().getId());
      matchInfo.put("user2_id", p2.getUser().getId());
      matchInfo.put("winner", null);
      matchInfo.put("result", null);
      sseService.addMatch(contest.getId(), session.getId(), roundNumber, matchInfo);

      redisTemplate.opsForList().leftPush(swissRound + round.getId() + matchKey, String.valueOf(savedMatch.getId()));
      try {
        enqueueSwissMatchToGradingQueue(
            savedMatch.getId(),
            contest,
            p1.getSubmission(),
            p2.getSubmission(),
            0);
        matchCount++;
      } catch (Exception e) {
        log.error("[스위스리그] matchId={} 큐 적재 실패", savedMatch.getId(), e);
        throw new RuntimeException("스위스 큐 적재 실패", e);
      }
    }

    // 홀수 부전승 처리
    if (participants.size() % 2 == 1) {
      CodeBattleParticipant bye = participants.get(participants.size() - 1);

      ContestSwissMatch byeMatch = new ContestSwissMatch();
      byeMatch.setRound(round);
      byeMatch.setUser1(bye.getUser());
      byeMatch.setUser2(null);
      byeMatch.setResult(ResultType.BYE);
      byeMatch.setWinner(bye.getUser());
      byeMatch = swissMatchRepository.save(byeMatch);
      redisTemplate.opsForList().leftPush(swissRound + round.getId() + matchKey,
          String.valueOf(byeMatch.getId()));
      redisTemplate.opsForValue().increment(swissRound + round.getId() + doneKey);
      matchCount++;

      // 부전승 매치도 matches에 추가 후 전송
      Map<String, Object> byeMatchInfo = new LinkedHashMap<>();
      byeMatchInfo.put("match_id", byeMatch.getId());
      byeMatchInfo.put("user1_id", bye.getUser().getId());
      byeMatchInfo.put("user2_id", null);
      byeMatchInfo.put("winner", 1);
      byeMatchInfo.put("result", ResultType.BYE);
      sseService.addMatch(contest.getId(), session.getId(), roundNumber, byeMatchInfo);
      log.info("[스위스리그] roundId={} userId={} 부전승 처리", round.getId(), bye.getUser().getId());
    }
    log.info("[스위스리그] roundId={} round={} 매치 {}/{}개 생성 완료", round.getId(), roundNumber, matchCount, matchsPerRound);
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
    languagesNode.put("player1", s1.getLanguage().name().toLowerCase());
    languagesNode.put("player2", s2.getLanguage().name().toLowerCase());

    String payload = objectMapper.writeValueAsString(rootNode);
    Long queueSize = redisTemplate.opsForList().leftPush(CODE_BATTLE_SWISS_LEAGUE_QUEUE_KEY, payload);

    log.info("[스위스리그] 큐 적재 완료. matchId={}, queueSize={}", matchId, queueSize);
  }

  @Transactional
  public void aggregateSwissRound(Long roundId) {
    log.info("[스위스리그] roundId={} 집계 시작", roundId);
    try {
      ContestSwissRound round = swissRoundRepository.findById(roundId)
          .orElseThrow(() -> new IllegalArgumentException("라운드를 찾을 수 없습니다. id=" + roundId));
      Long contestId = round.getSession().getContest().getId();

      List<String> matchIdStrs = redisTemplate.opsForList()
          .range(swissRound + roundId + matchKey, 0, -1);
      List<Long> matchIds = matchIdStrs.stream().map(Long::parseLong).collect(Collectors.toList());

      List<ContestSwissMatch> allMatches = swissMatchRepository.findAllById(matchIds);

      for (ContestSwissMatch m : allMatches) {
        if (m.getResult() == ResultType.BYE) {
          CodeBattleParticipant p = participantRepository
              .findByContestIdAndUserId(contestId, m.getUser1().getId());
          p.setScore(p.getScore() + 1);
          participantRepository.save(p);
          continue;
        }
        Long u1 = m.getUser1().getId();
        Long u2 = m.getUser2().getId();

        CodeBattleParticipant p1 = participantRepository.findByContestIdAndUserId(contestId, u1);
        CodeBattleParticipant p2 = participantRepository.findByContestIdAndUserId(contestId, u2);

        if (m.getResult() == ResultType.WIN1) {
          p1.setScore(p1.getScore() + 1);
          p2.setScore(p2.getScore() - 1);
        } else if (m.getResult() == ResultType.WIN2) {
          p2.setScore(p2.getScore() + 1);
          p1.setScore(p1.getScore() - 1);
        }
        participantRepository.save(p1);
        participantRepository.save(p2);
      }

      // 라운드 완료 처리
      round.setFinishedAt(LocalDateTime.now());
      round.setStatus(MatchStatus.FINISHED);
      swissRoundRepository.save(round);

      ContestSwissSession session = round.getSession();
      String totalStr = redisTemplate.opsForValue()
          .get("swiss:session:" + session.getId() + totalKey);

      sseService.updateRoundStatus(contestId, session.getId(), round.getRoundNumber(), "FINISHED");

      int totalRounds = Integer.parseInt(totalStr);
      int nextRound = round.getRoundNumber() + 1;
      if (nextRound <= totalRounds) {
        List<CodeBattleParticipant> participants = participantRepository
            .findByContestIdAndSubmissionIsNotNull(contestId)
            .stream()
            .filter(p -> p.getSubmission().getLanguage() != null
                && p.getSubmission().getCodeUrl() != null)
            .collect(Collectors.toList());

        log.info("[스위스리그] sessionId={} 다음 라운드 {} 시작", session.getId(), nextRound);
        redisTemplate.opsForValue().increment("swiss:session:" + session.getId() + doneKey);
        generateSwissRound(session.getContest(), session, participants, nextRound);
      } else {
        log.info("[스위스리그] sessionId={} 모든 라운드 완료 → 세션 집계", session.getId());
        aggregateSwissSession(session.getId());
      }

    } catch (Exception e) {
      log.error("[스위스리그] roundId={} 집계 실패", roundId, e);
    } finally {
      redisTemplate.delete(swissRound + roundId + totalKey);
      redisTemplate.delete(swissRound + roundId + doneKey);
      redisTemplate.delete(swissRound + roundId + matchKey);
      log.info("[스위스리그] roundId={} Redis 키 정리 완료", roundId);
    }
  }

  public void aggregateSwissSession(Long sessionId) {
    log.info("[스위스리그] sessionId={} 집계 시작", sessionId);

    try {
      ContestSwissSession session = swissSessionRepository.findById(sessionId)
          .orElseThrow(() -> new IllegalArgumentException("세션 없음: " + sessionId));
      Long contestId = session.getContest().getId();

      // 매치 목록을 DB 조회 (최종)
      List<ContestSwissMatch> allMatches = swissMatchRepository
          .findByRound_Session_IdAndRound_Status(sessionId, MatchStatus.FINISHED);

      // 승/무/패 집계 현재 부전승은 집계 안함
      Map<Long, Integer> winsMap = new HashMap<>();
      Map<Long, Integer> drawsMap = new HashMap<>();
      Map<Long, Integer> lossesMap = new HashMap<>();
      Map<Long, List<Long>> userMatchIds = new HashMap<>();
      Map<Long, List<Long>> opponentsMap = new HashMap<>();

      for (ContestSwissMatch m : allMatches) {
        if (m.getResult() == ResultType.BYE) {
          Long uid = m.getUser1().getId();
          winsMap.merge(uid, 1, Integer::sum);
          userMatchIds.computeIfAbsent(uid, k -> new ArrayList<>()).add(m.getId());
          continue;
        }
        Long u1 = m.getUser1().getId();
        Long u2 = m.getUser2().getId();

        userMatchIds.computeIfAbsent(u1, k -> new ArrayList<>()).add(m.getId());
        userMatchIds.computeIfAbsent(u2, k -> new ArrayList<>()).add(m.getId());
        opponentsMap.computeIfAbsent(u1, k -> new ArrayList<>()).add(u2);
        opponentsMap.computeIfAbsent(u2, k -> new ArrayList<>()).add(u1);

        if (m.getResult() == ResultType.WIN1) {
          winsMap.merge(u1, 1, Integer::sum);
          lossesMap.merge(u2, 1, Integer::sum);
        } else if (m.getResult() == ResultType.WIN2) {
          winsMap.merge(u2, 1, Integer::sum);
          lossesMap.merge(u1, 1, Integer::sum);
        } else if (m.getResult() == ResultType.DRAW) {
          drawsMap.merge(u1, 1, Integer::sum);
          drawsMap.merge(u2, 1, Integer::sum);
        }
      }
      // pointsMap: 승+1, 패-1, 무0
      Map<Long, Integer> pointsMap = new HashMap<>();
      for (Long userId : userMatchIds.keySet()) {
        int points = winsMap.getOrDefault(userId, 0)
            - lossesMap.getOrDefault(userId, 0);
        pointsMap.put(userId, points);
      }

      Map<Long, LocalDateTime> submissionTimeMap = new HashMap<>();
      participantRepository.findByContestId(contestId).forEach(p -> {
        if (p.getSubmission() != null && p.getSubmission().getCreatedAt() != null) {
          submissionTimeMap.put(p.getUser().getId(), p.getSubmission().getCreatedAt());
        }
      });
      List<Long> userIds = new ArrayList<>(userMatchIds.keySet());
      userIds.sort((a, b) -> {
        int cmp = Integer.compare(
            pointsMap.getOrDefault(b, 0),
            pointsMap.getOrDefault(a, 0));
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
        s.put("points", pointsMap.getOrDefault(userId, 0));
        s.put("rank", i + 1);
        s.put("opponents", opponentsMap.getOrDefault(userId, List.of()));
        s.put("match_ids", userMatchIds.getOrDefault(userId, List.of()));
        standings.add(s);
      }
      List<ContestSwissRound> allRounds = swissRoundRepository.findBySessionIdAndStatusOrderByRoundNumber(sessionId,
          MatchStatus.FINISHED);
      List<Map<String, Object>> roundList = new ArrayList<>();
      for (ContestSwissRound round : allRounds) {
        List<Map<String, Object>> matchList = new ArrayList<>();
        for (ContestSwissMatch m : allMatches) {
          if (!m.getRound().getId().equals(round.getId()))
            continue;
          Map<String, Object> matchMap = new LinkedHashMap<>();
          matchMap.put("match_id", m.getId());
          matchMap.put("user1_id", m.getUser1().getId());
          matchMap.put("user2_id", m.getUser2() != null ? m.getUser2().getId() : null);
          matchMap.put("winner", m.getWinner() != null
              ? (m.getWinner().getId().equals(m.getUser1().getId()) ? (Integer) 1 : (Integer) 2)
              : (m.getResult() == ResultType.DRAW ? (Integer) 0 : null));
          matchMap.put("result", m.getResult() != null ? m.getResult().name() : null);
          matchList.add(matchMap);
        }
        Map<String, Object> roundMap = new LinkedHashMap<>();
        roundMap.put("round_number", round.getRoundNumber());
        roundMap.put("status", round.getStatus());
        roundMap.put("matches", matchList);
        roundList.add(roundMap);
      }

      Map<String, Object> result = new LinkedHashMap<>();
      result.put("session_number", session.getSessionNumber());
      result.put("total_participants", userIds.size());
      result.put("total_rounds", allRounds.size());
      result.put("final_standings", standings);
      result.put("rounds", roundList);
      String json = objectMapper.writeValueAsString(result);

      String key = String.format("backend-deploy/contest-resource/%d/swiss-result/session-%d", contestId,
          session.getSessionNumber());
      s3Service.uploadJsonResult(key, json);
      log.info("[스위스리그] sessionId={} S3 저장 완료. key={}", sessionId, key);

      // 세션 완료 처리
      session.setFinishedAt(LocalDateTime.now());
      session.setStatus(ContestStatus.END);
      swissSessionRepository.save(session);

      // 세션 status END 갱신, 전송 후 메모리 정리
      sseService.updateSessionStatus(contestId, sessionId, "END");
      sseService.clearSession(contestId, sessionId);

    } catch (Exception e) {
      log.error("[스위스리그] sessionId={} 집계 실패", sessionId, e);
    } finally {
      redisTemplate.delete("swiss:session:" + sessionId + totalKey);
      redisTemplate.delete("swiss:session:" + sessionId + doneKey);
      log.info("[스위스리그] sessionId={} Redis 키 정리 완료", sessionId);
    }
  }

  @Transactional
  public void processSwissResult(String rawData) throws JsonProcessingException {
    CodeBattleMatchResult result = objectMapper.readValue(rawData, CodeBattleMatchResult.class);
    ContestSwissMatch match = swissMatchRepository.findById(result.getMatchId())
        .orElseThrow(() -> new RuntimeException("Match not found (ID: " + result.getMatchId() + ")"));

    if (match.getResult() != ResultType.BYE) {
      int comp = result.getWinner();
      if (comp == 1) {
        match.setWinner(match.getUser1());
        match.setResult(ResultType.WIN1);
      } else if (comp == 2) {
        match.setWinner(match.getUser2());
        match.setResult(ResultType.WIN2);

      } else if (comp == 0 || comp == -1)
      // 타임아웃 임시 무승부 처리
      {
        match.setWinner(null);
        match.setResult(ResultType.DRAW);
      }
      match.setLog(result.getLog());
      swissMatchRepository.save(match);

      Long contestId = match.getRound().getSession().getContest().getId();
      Long sessionId = match.getRound().getSession().getId();
      sseService.updateMatchResult(
          contestId, sessionId,
          match.getRound().getRoundNumber(),
          match.getId(),
          result.getWinner(),
          match.getResult());

    } else

    {
      sseService.sendToUser(match.getUser1().getId(), result);
    }

    // 라운드 완료 체크
    Long roundId = match.getRound().getId();
    Long roundDone = redisTemplate.opsForValue().increment(swissRound + roundId + doneKey);
    String roundTotalStr = redisTemplate.opsForValue().get(swissRound + roundId + totalKey);
    if (roundTotalStr == null) {
      log.warn("[스위스리그] round:{} total 키 없음", roundId);
      return;
    }
    long roundTotal = Long.parseLong(roundTotalStr);
    log.info("[스위스리그] roundId={} {}/{}", roundId, roundDone, roundTotal);

    if (roundDone.equals(roundTotal)) {
      aggregateSwissRound(roundId);
    }
  }

  public void restoreSessionState(Long contestId, Long sessionId) {
    if (sseService.getSessionState(contestId, sessionId) != null)
      return;

    ContestSwissSession session = swissSessionRepository.findById(sessionId).orElse(null);
    if (session == null)
      return;

    List<ContestSwissRound> rounds = swissRoundRepository.findBySessionId(sessionId);
    rounds.sort(Comparator.comparing(ContestSwissRound::getRoundNumber));

    String totalStr = redisTemplate.opsForValue().get("swiss:session:" + sessionId + totalKey);
    int totalRounds = (totalStr != null) ? Integer.parseInt(totalStr) : rounds.size();

    Map<String, Object> state = new LinkedHashMap<>();
    state.put("session_number", session.getSessionNumber());
    state.put("status", session.getStatus().name());
    state.put("total_rounds", totalRounds);

    List<Map<String, Object>> roundsList = new ArrayList<>();
    for (ContestSwissRound round : rounds) {
      Map<String, Object> roundState = new LinkedHashMap<>();
      roundState.put("round_number", round.getRoundNumber());
      roundState.put("status", round.getStatus().name());

      List<ContestSwissMatch> matches = swissMatchRepository.findByRoundId(round.getId());
      List<Map<String, Object>> matchList = new ArrayList<>();
      for (ContestSwissMatch match : matches) {
        Map<String, Object> matchInfo = new LinkedHashMap<>();
        matchInfo.put("match_id", match.getId());
        matchInfo.put("user1_id", match.getUser1().getId());
        matchInfo.put("user2_id", match.getUser2() != null ? match.getUser2().getId() : null);

        if (match.getResult() == ResultType.BYE) {
          matchInfo.put("winner", 1);
          matchInfo.put("result", ResultType.BYE);
        } else if (match.getResult() != null) {
          Integer winnerNum = null;
          if (match.getWinner() != null) {
            winnerNum = match.getWinner().getId().equals(match.getUser1().getId()) ? 1 : 2;
          }
          matchInfo.put("winner", winnerNum);
          matchInfo.put("result", match.getResult());
        } else {
          matchInfo.put("winner", null);
          matchInfo.put("result", null);
        }
        matchList.add(matchInfo);
      }
      roundState.put("matches", matchList);
      roundsList.add(roundState);
    }
    state.put("rounds", roundsList);

    sseService.updateSessionState(contestId, sessionId, state);
    log.info("[스위스리그] sessionId={} DB에서 상태 복원 완료. rounds={}", sessionId, rounds.size());
  }
}
