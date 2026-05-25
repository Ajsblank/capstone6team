package com.asap.server.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
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

  private final Map<Long, Map<String, Object>> sessionStateMap = new ConcurrentHashMap<>();

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
      // session.setContest(contest); 미리 처리됨
      session.setSessionNumber(sessionNumber);
      session.setStartedAt(LocalDateTime.now());
      // SessionStatus
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
        // SessionStatus
        session.setStatus(ContestStatus.END);
        session.setFinishedAt(LocalDateTime.now());
        session = swissSessionRepository.save(session);
        log.warn("[스위스리그] contestId={} session={} 현재 정상 제출이 없으므로 세션이 종료됩니다.",
            contestId, sessionNumber);
        return;
      }

      // 모든 참가자의 score를 0으로 초기화
      for (CodeBattleParticipant p : participants) {
        p.setScore(0);
      }
      // 초기화된 점수 DB 반영
      participantRepository.saveAll(participants);
      int roundsPerSession;
      int size = participants.size();
      if (size < 1) {
        log.error("[스위스리그] contestId={} sessionId={} 라운드 계산 오류", contestId, sessionId);
        return;
      } else {
        // 라운드 수 계산
        int log2Ceil = size <= 1 ? 0 : 32 - Integer.numberOfLeadingZeros(size - 1);
        roundsPerSession = log2Ceil + 1;
      }
      // sse 정보 초기화
      Map<String, Object> sessionState = new LinkedHashMap<>();
      sessionState.put("session_number", sessionNumber);
      sessionState.put("status", "RUNNING");
      sessionState.put("total_rounds", roundsPerSession);
      sessionState.put("rounds", new ArrayList<>());
      sessionStateMap.put(session.getId(), sessionState);
      sseService.sendToSession(contestId, session.getId(), sessionState, "session-state");

      redisTemplate.opsForValue().set("swiss:session:" + session.getId() + totalKey, String.valueOf(roundsPerSession));
      redisTemplate.opsForValue().set("swiss:session:" + session.getId() + doneKey, "0");
      // 3. 스위스 매칭 실행 (generateSwissRound 호출)
      generateSwissRound(contest, session, participants, 1);
      log.info("[스위스리그] contestId={} session={} 시작 완료", contestId, sessionNumber);

    } catch (

    Exception e) {
      log.error("[스위스리그] contestId={} session={} 시작 중 오류 발생", contestId, sessionNumber, e);
    }
  }

  @Transactional
  public void generateSwissRound(CodeBattleContest contest, ContestSwissSession session,
      List<CodeBattleParticipant> participants, int roundNumber) {

    // 점수순 내림차순 정렬
    participants.sort(Comparator.comparingInt(
        (CodeBattleParticipant p) -> p.getScore() == null ? 0 : p.getScore()).reversed());

    // 라운드 엔티티 생성
    ContestSwissRound round = new ContestSwissRound();
    round.setSession(session);
    round.setRoundNumber(roundNumber);
    round.setStatus(MatchStatus.RUNNING);
    // 순차 라운드 실행 필요, 실행 시 시작 시간 설정 필요
    round.setStartedAt(LocalDateTime.now());
    round = swissRoundRepository.save(round);

    int matchsPerRound = participants.size() / 2;
    if (participants.size() % 2 == 1)
      matchsPerRound++;
    // 홀수 처리 필요 (매치로 넘길지 따로 처리할지)

    // 라운드 상태 초기화 및 sessionStateMap에 추가
    Map<String, Object> roundState = new LinkedHashMap<>();
    roundState.put("round_number", roundNumber);
    roundState.put("status", "RUNNING");
    roundState.put("matches", new ArrayList<>());
    Map<String, Object> currentState = sessionStateMap.get(session.getId());
    if (currentState != null) {
      @SuppressWarnings("unchecked")
      List<Map<String, Object>> rounds = (List<Map<String, Object>>) currentState.get("rounds");
      if (rounds != null) rounds.add(roundState);
    }

    int matchCount = 0;
    for (int j = 0; j + 1 < participants.size(); j += 2) {
      CodeBattleParticipant p1 = participants.get(j);
      CodeBattleParticipant p2 = participants.get(j + 1);
      // 선 후공 중복 필요 + 추후 로직 수정 편하기 위한 추상화나 코드 정리 필요
      ContestSwissMatch match = new ContestSwissMatch();
      match.setRound(round);
      match.setUser1(p1.getUser());
      match.setUser2(p2.getUser());
      ContestSwissMatch savedMatch = swissMatchRepository.save(match);

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
    // 라운드 Redis 초기화 - total을 마지막에 세팅 (경합 방지)
    redisTemplate.opsForValue().set(swissRound + round.getId() + totalKey, String.valueOf(matchsPerRound));
    redisTemplate.opsForValue().set(swissRound + round.getId() + doneKey, "0");

    // 홀수 부전승 처리
    if (participants.size() % 2 == 1) {
      CodeBattleParticipant bye = participants.get(participants.size() - 1);

      ContestSwissMatch byeMatch = new ContestSwissMatch();
      byeMatch.setRound(round);
      byeMatch.setUser1(bye.getUser());
      byeMatch.setUser2(null); // 상대 없음
      byeMatch.setResult(ResultType.BYE);
      byeMatch.setWinner(bye.getUser());
      byeMatch = swissMatchRepository.save(byeMatch);
      redisTemplate.opsForList().leftPush(swissRound + round.getId() + matchKey,
          String.valueOf(byeMatch.getId()));
      // 채점 없이 바로 done 증가
      redisTemplate.opsForValue().increment(swissRound + round.getId() + doneKey);
      matchCount++;

      // 부전승 매치도 roundState matches에 추가
      @SuppressWarnings("unchecked")
      List<Map<String, Object>> byeMatches = (List<Map<String, Object>>) roundState.get("matches");
      if (byeMatches != null) {
        Map<String, Object> byeMatchInfo = new LinkedHashMap<>();
        byeMatchInfo.put("match_id", byeMatch.getId());
        byeMatchInfo.put("user1_id", bye.getUser().getId());
        byeMatchInfo.put("user2_id", null);
        byeMatchInfo.put("winner", 1);
        byeMatchInfo.put("result", ResultType.BYE);
        byeMatches.add(byeMatchInfo);
      }
      log.info("[스위스리그] roundId={} userId={} 부전승 처리", round.getId(), bye.getUser().getId());
    }

    log.info("[스위스리그] roundId={} round={} 매치 {}/{}개 생성 완료", round.getId(), roundNumber, matchCount, matchsPerRound);

    // 라운드/매치 생성 후 세션 상태 전송
    if (currentState != null) {
      sseService.sendToSession(contest.getId(), session.getId(), currentState, "session-state");
    }
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

    log.info("[스위스리그] 큐 적재 완료. matchId={}, queueSize={}", matchId, queueSize);
  }

  @Transactional
  public void aggregateSwissRound(Long roundId) {
    log.info("[스위스리그] roundId={} 집계 시작", roundId);
    try {
      // 세션 소속 contestId 조회
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
        } else if (m.getResult() == ResultType.WIN2) {
          p2.setScore(p2.getScore() + 1);
        }
        participantRepository.save(p1);
        participantRepository.save(p2);
      }

      // 라운드 완료 처리
      round.setFinishedAt(LocalDateTime.now());
      round.setStatus(MatchStatus.FINISHED);
      swissRoundRepository.save(round);
      // 다음 라운드 처리
      ContestSwissSession session = round.getSession();
      String totalStr = redisTemplate.opsForValue()
          .get("swiss:session:" + session.getId() + totalKey);

      // 라운드 완료 시 sessionStateMap 갱신 및 전송
      Map<String, Object> sessionState = sessionStateMap.get(session.getId());
      if (sessionState != null) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rounds = (List<Map<String, Object>>) sessionState.get("rounds");
        if (rounds != null) {
          rounds.stream()
              .filter(r -> ((Number) r.get("round_number")).intValue() == round.getRoundNumber())
              .findFirst()
              .ifPresent(r -> r.put("status", "FINISHED"));
        }
        sseService.sendToSession(contestId, session.getId(), sessionState, "session-state");
      }

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
          .findByRound_Session_Id(sessionId);

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

        if (ResultType.WIN1.equals(m.getResult() != null ? m.getResult() : "")) {
          winsMap.merge(u1, 1, Integer::sum);
          lossesMap.merge(u2, 1, Integer::sum);
        } else if (ResultType.WIN2.equals(m.getResult() != null ? m.getResult() : "")) {
          winsMap.merge(u2, 1, Integer::sum);
          lossesMap.merge(u1, 1, Integer::sum);
        }
        // 무승부 집계
        else if (ResultType.DRAW.equals(m.getResult() != null ? m.getResult() : "")) {
          drawsMap.merge(u1, 1, Integer::sum);
          drawsMap.merge(u2, 1, Integer::sum);
        }
      }

      // 제출 시간 맵
      // 참가자 score 맵으로 로드
      Map<Long, LocalDateTime> submissionTimeMap = new HashMap<>();
      Map<Long, Integer> scoreMap = new HashMap<>();
      participantRepository.findByContestId(contestId).forEach(p -> {
        scoreMap.put(p.getUser().getId(), p.getScore() == null ? 0 : p.getScore());
        if (p.getSubmission() != null && p.getSubmission().getCreatedAt() != null) {
          submissionTimeMap.put(p.getUser().getId(), p.getSubmission().getCreatedAt());
        }
      });

      List<Long> userIds = new ArrayList<>(userMatchIds.keySet());
      userIds.sort((a, b) -> {
        int cmp = Integer.compare(
            scoreMap.getOrDefault(b, 0),
            scoreMap.getOrDefault(a, 0));
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
        s.put("points", scoreMap.getOrDefault(userId, 0));
        s.put("rank", i + 1);
        s.put("opponents", opponentsMap.getOrDefault(userId, List.of()));
        s.put("match_ids", userMatchIds.getOrDefault(userId, List.of()));
        standings.add(s);
      }

      Map<String, Object> result = new LinkedHashMap<>();
      result.put("session_number", session.getSessionNumber());
      result.put("total_participants", userIds.size());
      result.put("final_standings", standings);
      String json = objectMapper.writeValueAsString(result);

      // S3 저장: contest-resource/{contestId}/swiss-result/{session_number}
      String key = String.format("backend-deploy/contest-resource/%d/swiss-result/session-%d", contestId,
          session.getSessionNumber());
      s3Service.uploadJsonResult(key, json);
      log.info("[스위스리그] sessionId={} S3 저장 완료. key={}", sessionId, key);

      // 세션 완료 처리
      session.setFinishedAt(LocalDateTime.now());
      session.setStatus(ContestStatus.END);
      swissSessionRepository.save(session);

      // 세션 종료 시 sessionStateMap 갱신, 전송 및 제거
      Map<String, Object> endState = sessionStateMap.get(sessionId);
      if (endState != null) {
        endState.put("status", "END");
        sseService.sendToSession(contestId, sessionId, endState, "session-state");
        sessionStateMap.remove(sessionId);
      }

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

    // 매치 결과 저장
    if (match.getResult() != ResultType.BYE) {
      int comp = result.getWinner();
      if (comp == 1) {
        match.setWinner(match.getUser1());
        match.setResult(ResultType.WIN1);
      } else if (comp == 2) {
        match.setWinner(match.getUser2());
        match.setResult(ResultType.WIN2);
      } else if (comp == 0) {
        match.setWinner(null);
        match.setResult(ResultType.DRAW);
      }
      match.setLog(result.getLog());
      swissMatchRepository.save(match);

      Long contestId = match.getRound().getSession().getContest().getId();
      Long sessionId = match.getRound().getSession().getId();
      int roundNumber = match.getRound().getRoundNumber();

      // 매치 결과 sessionStateMap 갱신 및 전송
      Map<String, Object> sessionState = sessionStateMap.get(sessionId);
      if (sessionState != null) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rounds = (List<Map<String, Object>>) sessionState.get("rounds");
        if (rounds != null) {
          rounds.stream()
              .filter(r -> ((Number) r.get("round_number")).intValue() == roundNumber)
              .findFirst()
              .ifPresent(roundState -> {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> matches = (List<Map<String, Object>>) roundState.get("matches");
                if (matches != null) {
                  Map<String, Object> matchInfo = new LinkedHashMap<>();
                  matchInfo.put("match_id", match.getId());
                  matchInfo.put("user1_id", match.getUser1().getId());
                  matchInfo.put("user2_id", match.getUser2() != null ? match.getUser2().getId() : null);
                  matchInfo.put("winner", result.getWinner());
                  matchInfo.put("result", match.getResult());
                  matches.add(matchInfo);
                }
              });
        }
        sseService.sendToSession(contestId, sessionId, sessionState, "session-state");
      }

    } else { // 부전승 참가자 결과 전송
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

    if (roundDone == roundTotal) {
      aggregateSwissRound(roundId);
    }
  }
}
