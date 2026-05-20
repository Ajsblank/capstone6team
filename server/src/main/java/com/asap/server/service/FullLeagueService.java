package com.asap.server.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleMatch;
import com.asap.server.domain.CodeBattleParticipant;
import com.asap.server.domain.CodeBattleSubmission;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.CodeBattleMatchRepository;
import com.asap.server.repository.CodeBattleParticipantRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class FullLeagueService {

    private final CodeBattleContestRepository contestRepository;
    private final CodeBattleParticipantRepository participantRepository;
    private final CodeBattleMatchRepository matchRepository;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redisTemplate;
    private final S3Service s3Service;
    private final SseService sseService;

    private static final String CODE_BATTLE_FULL_LEAGUE_QUEUE_KEY = "code_battle_full_league_queue";

    public void fullLeagueGrading(Long contestId) { // 풀리그 시작 함수
        // 1. 대회 및 모든 제출 코드 조회
        CodeBattleContest contest = contestRepository.findById(contestId)
                .orElseThrow(() -> new IllegalArgumentException("대회를 찾을 수 없습니다. ID: " + contestId));

        if (contest.getStatus() == com.asap.server.global.type.ContestStatus.CANCELED) {
            log.info("[SwissMatchMaker] 대회 ID {} 는 취소 상태(CANCELED)라 FullLeagueGrading을 스킵합니다.", contestId);
            return;
        }

        // 2. Participant 기준으로 제출 코드 1인 1개 조회
        try {
            List<CodeBattleSubmission> submissions = participantRepository
                    .findByContestIdAndSubmissionIsNotNull(contestId)
                    .stream()
                    .map(CodeBattleParticipant::getSubmission)
                    .filter(s -> {
                        // null 필드 있으면 해당 제출 스킵 + 로그
                        if (s.getLanguage() == null) {
                            log.warn("[SwissMatchMaker] submission ID {}의 language가 null, 스킵", s.getId());
                            return false;
                        }
                        if (s.getCodeUrl() == null) {
                            log.warn("[SwissMatchMaker] submission ID {}의 codeUrl가 null, 스킵", s.getId());
                            return false;
                        }
                        return true;
                    })
                    .collect(Collectors.toList());
            if (submissions == null || submissions.size() < 2) {
                log.warn("[SwissMatchMaker] 풀리그 대회 ID {} 제출 코드 부족으로 매칭을 생성하지 못했습니다. {}", contestId);
                return;
            }

            log.info("[SwissMatchMaker] 풀리그 대회 ID: {}, {}개의 제출 코드로 매칭을 생성합니다.", contestId, submissions.size());

            int expected = (submissions.size() * (submissions.size() - 1)) / 2;
            redisTemplate.opsForValue().set("contest:total:" + contestId, String.valueOf(expected));
            redisTemplate.opsForValue().set("contest:done:" + contestId, "0");
            log.info("[풀리그] contestId={} 카운터 미리 초기화. total={}", contestId, expected);
            int enqueued = 0;

            // 3. 풀리그 매칭 (i < j 로 중복 방지)
            for (int i = 0; i < submissions.size(); i++) {
                for (int j = i + 1; j < submissions.size(); j++) {
                    CodeBattleSubmission s1 = submissions.get(i);
                    CodeBattleSubmission s2 = submissions.get(j);

                    try {
                        // 매치 저장
                        CodeBattleMatch match = matchRepository.save(
                                new CodeBattleMatch(contest, s1.getUser(), s2.getUser(), null, null));
                        // 매치 ID Redis에 누적
                        redisTemplate.opsForList().leftPush("contest:matchIds:" + contestId,
                                String.valueOf(match.getId()));
                        // 큐에 적재
                        enqueueMatchToGradingQueue(match.getId(), contest, s1, s2, 0);
                        enqueued++;

                    } catch (Exception e) {
                        log.error("[SwissMatchMaker] 큐 적재 실패로 전체 중단. s1={}, s2={}, 원인={}",
                                s1.getId(), s2.getId(), e.getMessage());
                        // Redis 카운터 정리
                        redisTemplate.delete("contest:total:" + contestId);
                        redisTemplate.delete("contest:done:" + contestId);

                        throw new RuntimeException("풀리그 큐 적재 실패로 전체 중단", e);
                    }
                }
            }
            log.info(
                    "[SwissMatchMaker] 풀리그 대회 ID {} 매칭 완료. expected={}, enqueued={}",
                    contestId, expected, enqueued);
        } catch (RuntimeException e) {
            throw e; // 상위로 전파
        }
    }

    private void enqueueMatchToGradingQueue( // 풀리그 처리 함수
            Long matchId,
            CodeBattleContest contest,
            CodeBattleSubmission s1,
            CodeBattleSubmission s2,
            int aiOrder) throws Exception {

        // S3에서 코드 읽기 비활성화
        // log.info("[S3] judge={}", contest.getJudgeCode());
        // log.info("[S3] p1={}", s1.getCodeUrl());
        // log.info("[S3] p2={}", s2.getCodeUrl());

        // String judgeCode = s3Service.readFileAsString(contest.getJudgeCode());
        // String player1Code = s3Service.readFileAsString(s1.getCodeUrl());
        // String player2Code = s3Service.readFileAsString(s2.getCodeUrl());

        // log.info("[S3] 읽기 완료. judge={}자, p1={}자, p2={}자",
        // judgeCode.length(), player1Code.length(), player2Code.length());
        String judgeCode = contest.getJudgeCode();
        String player1Code = s1.getCodeUrl();
        String player2Code = s2.getCodeUrl();
        // S3 시 사용
        // log.info("[대회 처리] judge={}, 길이={}", judgeCode, judgeCode.length());
        // log.info("[대회 처리] p1={}, 길이={}", player1Code, player1Code.length());
        // log.info("[대회 처리] p2={}, 길이={}", player2Code, player2Code.length());
        log.info("[대회 처리] 길이={}", judgeCode.length());
        log.info("[대회 처리] 길이={}", player1Code.length());
        log.info("[대회 처리] 길이={}", player2Code.length());

        // JSON 구성
        ObjectNode rootNode = objectMapper.createObjectNode();
        rootNode.put("submissionId", matchId); // 이름 오류 부분 (정상 작동)
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
        Long queueSize = redisTemplate.opsForList().leftPush(CODE_BATTLE_FULL_LEAGUE_QUEUE_KEY, payload);

        log.info("[SwissMatchMaker] 큐 적재 완료. matchId={}, queueSize={}", matchId, queueSize);
    }

    public void aggregateAndSave(Long contestId) { // 풀리그 집계 함수

        log.info("[풀리그] contestId={} 최종 집계 시작", contestId);

        try {
            // 이번 채점 매치 ID만 조회
            List<String> matchIdStrs = redisTemplate.opsForList()
                    .range("contest:matchIds:" + contestId, 0, -1);

            List<Long> matchIds = matchIdStrs.stream()
                    .map(Long::parseLong)
                    .collect(Collectors.toList());
            // 해당 매치만 DB에서 조회
            List<CodeBattleMatch> allMatches = matchRepository.findAllById(matchIds);

            // 유저별 통계 Map
            Map<Long, Integer> winsMap = new HashMap<>();
            Map<Long, Integer> drawsMap = new HashMap<>();
            Map<Long, Integer> lossesMap = new HashMap<>();
            Map<Long, List<Long>> userMatchIds = new HashMap<>();
            for (CodeBattleMatch m : allMatches) {
                Long user1Id = m.getUser1().getId();
                Long user2Id = m.getUser2().getId();
                userMatchIds.computeIfAbsent(user1Id, k -> new ArrayList<>()).add(m.getId());
                userMatchIds.computeIfAbsent(user2Id, k -> new ArrayList<>()).add(m.getId());
                // 승/무/패 집계
                if ("WIN1".equals(m.getResult())) {
                    winsMap.merge(user1Id, 1, Integer::sum);
                    lossesMap.merge(user2Id, 1, Integer::sum);
                } else if ("WIN2".equals(m.getResult())) {
                    winsMap.merge(user2Id, 1, Integer::sum);
                    lossesMap.merge(user1Id, 1, Integer::sum);
                } else if ("DRAW".equals(m.getResult())) {
                    drawsMap.merge(user1Id, 1, Integer::sum);
                    drawsMap.merge(user2Id, 1, Integer::sum);
                }
            }
            Map<Long, LocalDateTime> submissionTimeMap = new HashMap<>();
            List<CodeBattleParticipant> participants = participantRepository.findByContestId(contestId);
            for (CodeBattleParticipant p : participants) {
                if (p.getSubmission() != null && p.getSubmission().getCreatedAt() != null) {
                    submissionTimeMap.put(p.getUser().getId(), p.getSubmission().getCreatedAt());
                }
            }
            // 유저 ID 목록 추출 후 points 기준 정렬
            List<Long> userIds = new ArrayList<>(userMatchIds.keySet());
            userIds.sort((a, b) -> { // Tim Sort 사용
                double pointsA = winsMap.getOrDefault(a, 0) * 1.0 + drawsMap.getOrDefault(a, 0) * 0.5;
                double pointsB = winsMap.getOrDefault(b, 0) * 1.0 + drawsMap.getOrDefault(b, 0) * 0.5;
                // 1순위: points 내림차순
                int cmp = Double.compare(pointsB, pointsA);
                if (cmp != 0)
                    return cmp;

                // 2순위: 제출 시간 오름차순 (빠를수록 유리)
                LocalDateTime timeA = submissionTimeMap.getOrDefault(a, LocalDateTime.MAX);
                LocalDateTime timeB = submissionTimeMap.getOrDefault(b, LocalDateTime.MAX);
                return timeA.compareTo(timeB);
            });
            // ✅ 4. standings 생성
            List<Map<String, Object>> standings = new ArrayList<>();
            for (int i = 0; i < userIds.size(); i++) {
                Long userId = userIds.get(i);

                int wins = winsMap.getOrDefault(userId, 0);
                int draws = drawsMap.getOrDefault(userId, 0);
                int losses = lossesMap.getOrDefault(userId, 0);
                double points = wins * 1.0 + draws * 0.5; // draw 값 정책

                Map<String, Object> standing = new LinkedHashMap<>();
                standing.put("user_id", userId);
                standing.put("wins", wins);
                standing.put("draws", draws);
                standing.put("losses", losses);
                standing.put("rank", i + 1);
                standing.put("points", points);
                standing.put("match_ids", userMatchIds.getOrDefault(userId, List.of()));
                standings.add(standing);
            }

            // 최종 JSON 생성
            Map<String, Object> finalResult = new LinkedHashMap<>();
            finalResult.put("total_participants", userIds.size());
            finalResult.put("final-standings", standings);
            String json = objectMapper.writeValueAsString(finalResult);

            // S3 저장
            String key = s3Service.buildFinalResultKey(contestId);
            s3Service.uploadJsonResult(key, json);
            log.info("[풀리그] contestId={} S3 저장 완료", contestId);

            // SSE 전송 — 참가자 전원에게
            for (Long userId : userIds) {
                sseService.sendToUser(userId, json, "contest-end");
            }
            log.info("[풀리그] contestId={} SSE 전송 완료", contestId);

        } catch (Exception e) {
            log.error("[풀리그] contestId={} 집계 저장 실패: {}", contestId, e.getMessage());
        } finally {
            // 7. Redis 키 정리
            redisTemplate.delete("contest:total:" + contestId);
            redisTemplate.delete("contest:done:" + contestId);
            redisTemplate.delete("contest:matchIds:" + contestId); // ✅ 추가
            log.info("[풀리그] contestId={} Redis 키 정리 완료", contestId);
        }
    }

}