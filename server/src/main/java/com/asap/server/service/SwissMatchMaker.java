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
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleMatch;
import com.asap.server.domain.CodeBattleParticipant;
import com.asap.server.domain.CodeBattleSubmission;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.CodeBattleMatchRepository;
import com.asap.server.repository.CodeBattleParticipantRepository;
import com.asap.server.repository.CodeBattleSubmissionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class SwissMatchMaker {

    private final CodeBattleContestRepository contestRepository;
    private final CodeBattleParticipantRepository participantRepository;
    private final CodeBattleMatchRepository matchRepository;
    private final CodeBattleSubmissionRepository submissionRepository;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redisTemplate;
    private final S3Service s3Service;
    private final SseService sseService;

    private static final String CODE_BATTLE_GRADING_QUEUE_KEY = "code_battle_grading_queue";
    private static final String PULL_LEAGUE_MATCH_DEDUP_KEY_PREFIX = "code_battle:pull_league:dedup:";

    public void queuePullLeagueForNewSubmission(Long contestId, Long submissionId) {
        CodeBattleContest contest = contestRepository.findById(contestId)
                .orElseThrow(() -> new IllegalArgumentException("대회를 찾을 수 없습니다. ID: " + contestId));

        CodeBattleSubmission newSubmission = submissionRepository.findByIdAndContest_Id(submissionId, contestId)
                .orElseThrow(() -> new IllegalArgumentException("대회 제출을 찾을 수 없습니다. submissionId: " + submissionId));

        List<CodeBattleSubmission> submissions = submissionRepository.findByContest_Id(contestId);
        if (submissions == null || submissions.size() < 2) {
            return;
        }

        String dedupSetKey = PULL_LEAGUE_MATCH_DEDUP_KEY_PREFIX + contestId;
        int enqueued = 0;

        for (CodeBattleSubmission opponent : submissions) {
            if (opponent.getId().equals(newSubmission.getId())) {
                continue;
            }
            if (newSubmission.getUser().getId().equals(opponent.getUser().getId())) {
                continue;
            }

            long leftId = Math.min(newSubmission.getId(), opponent.getId());
            long rightId = Math.max(newSubmission.getId(), opponent.getId());
            String dedupMember = leftId + ":" + rightId;

            if (Boolean.TRUE.equals(redisTemplate.opsForSet().isMember(dedupSetKey, dedupMember))) {
                continue;
            }

            try {
                CodeBattleMatch match = new CodeBattleMatch(
                        contest,
                        newSubmission.getUser(),
                        opponent.getUser(),
                        null,
                        null);
                match = matchRepository.save(match);

                enqueueMatchToGradingQueue(match.getId(), contest, newSubmission, opponent, 0);
                redisTemplate.opsForSet().add(dedupSetKey, dedupMember);
                enqueued++;
            } catch (Exception e) {
                log.error("[SwissMatchMaker] Redis 전송 실패 - submissionId1: {}, submissionId2: {}",
                        newSubmission.getId(), opponent.getId(), e);
            }
        }

        log.info("[SwissMatchMaker] 신규 제출 기반 풀리그 큐 적재 완료. contestId: {}, submissionId: {}, enqueued: {}",
                contestId, submissionId, enqueued);
    }

    public void pullLeagueGrading(Long contestId) {
        // 1. 대회 및 모든 제출 코드 조회
        CodeBattleContest contest = contestRepository.findById(contestId)
                .orElseThrow(() -> new IllegalArgumentException("대회를 찾을 수 없습니다. ID: " + contestId));

        if (contest.getStatus() == com.asap.server.global.type.ContestStatus.CANCELED) {
            log.info("[SwissMatchMaker] 대회 ID {} 는 취소 상태(CANCELED)라 pullLeagueGrading을 스킵합니다.", contestId);
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
        ObjectNode root = objectMapper.createObjectNode();
        root.put("submissionId", matchId); // 이름 오류 부분 (정상 작동)
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
        Long queueSize = redisTemplate.opsForList().leftPush(CODE_BATTLE_GRADING_QUEUE_KEY, payload);

        log.info("[SwissMatchMaker] 큐 적재 완료. matchId={}, queueSize={}", matchId, queueSize);
    }

    public List<CodeBattleMatch> makeMatches(List<CodeBattleParticipant> participants, CodeBattleContest contest) {
        List<CodeBattleMatch> matches = new ArrayList<>();

        // 매칭할 인원이 2명 미만이면 매칭 불가
        if (participants == null || participants.size() < 2) {
            return matches;
        }

        // 참가자들을 점수(score) 기준으로 내림차순 정렬
        List<CodeBattleParticipant> sortedParticipants = new ArrayList<>(participants);
        sortedParticipants.sort(Comparator.comparingInt(
                (CodeBattleParticipant p) -> p.getScore() == null ? 0 : p.getScore()).reversed());

        // 2명씩 짝지어서 매치 엔티티 생성
        for (int i = 0; i < sortedParticipants.size() - 1; i += 2) {
            CodeBattleParticipant p1 = sortedParticipants.get(i);
            CodeBattleParticipant p2 = sortedParticipants.get(i + 1);

            CodeBattleMatch match = new CodeBattleMatch(
                    contest,
                    p1.getUser(),
                    p2.getUser(),
                    null, // winner
                    null // log
            );
            matches.add(match);
        }

        return matches;
    }

    @Transactional
    public void generateNextRound(Long contestId) {
        // 대회 및 참가자 정보 조회
        CodeBattleContest contest = contestRepository.findById(contestId)
                .orElseThrow(() -> new IllegalArgumentException("대회를 찾을 수 없습니다. ID: " + contestId));
        List<CodeBattleParticipant> participants = participantRepository.findByContestId(contestId);

        // 한 라운드당 진행되는 총 경기 수 계산
        int matchesPerRound = participants.size() / 2;
        if (matchesPerRound == 0) {
            log.warn("[SwissMatchMaker] 대회 ID {} 참가자 부족으로 매칭을 생성하지 못했습니다.", contestId);
            return;
        }

        long totalMatches = matchRepository.countByContestId(contestId);
        int nextRound = (int) (totalMatches / matchesPerRound) + 1;

        log.info("[SwissMatchMaker] 대회 ID: {}, {}라운드 매칭을 생성합니다.", contestId, nextRound);

        // 점수순 정렬 (내림차순)
        participants.sort(Comparator.comparingInt(
                (CodeBattleParticipant p) -> p.getScore() == null ? 0 : p.getScore()).reversed());

        List<CodeBattleMatch> matches = new ArrayList<>();

        // 2명씩 짝짓기 (엔티티 수정 안 함)
        for (int i = 0; i < participants.size() - 1; i += 2) {
            CodeBattleMatch match = new CodeBattleMatch(
                    contest,
                    participants.get(i).getUser(),
                    participants.get(i + 1).getUser(),
                    null, // winner
                    null // log
            );
            matches.add(match);
        }

        // DB에 매칭 정보 저장
        matchRepository.saveAll(matches);
        log.info("[SwissMatchMaker] 대회 ID {} 매칭 완료. 총 {}개의 경기가 생성되었습니다.", contestId, matches.size());

        // Redis JSON 전송 로직
        // 유저 ID를 키로 하여 빠르게 Participant(제출 코드 보유)를 찾기 위한 맵 구성
        Map<Long, CodeBattleParticipant> participantMap = participants.stream()
                .collect(Collectors.toMap(p -> p.getUser().getId(), p -> p));

        for (CodeBattleMatch match : matches) {
            try {
                // 각 매치의 참가자 정보 꺼내기
                CodeBattleParticipant p1 = participantMap.get(match.getUser1().getId());
                CodeBattleParticipant p2 = participantMap.get(match.getUser2().getId());

                // JSON 페이로드 구성
                ObjectNode rootNode = objectMapper.createObjectNode();
                rootNode.put("submissionId", match.getId());
                rootNode.put("language1", p1.getSubmission().getLanguage().name());
                rootNode.put("language2", p2.getSubmission().getLanguage().name());
                rootNode.put("aiOrder", match.getAiOrder());
                rootNode.put("timeLimitSec", contest.getTimeLimitSec());
                rootNode.put("memoryLimitMb", contest.getMemoryLimitMB());

                String judgeCode = s3Service.readFileAsString(contest.getJudgeCode());
                String player1Code = s3Service.readFileAsString(p1.getSubmission().getCodeUrl());
                String player2Code = s3Service.readFileAsString(p2.getSubmission().getCodeUrl());

                ObjectNode codesNode = rootNode.putObject("codes");
                codesNode.put("judge", judgeCode);
                codesNode.put("player1", player1Code);
                codesNode.put("player2", player2Code);

                String jsonPayload = objectMapper.writeValueAsString(rootNode);

                // Redis에 왼쪽(Left)으로 Push (List 자료구조)
                Long queueSize = redisTemplate.opsForList().leftPush(CODE_BATTLE_GRADING_QUEUE_KEY, jsonPayload);
                log.info("[SwissMatchMaker] grading queue push success. submissionId={}, queueSize={}",
                        match.getId(), queueSize);

            } catch (Exception e) {
                // 특정 매치 JSON 생성/전송 실패 시 에러 로깅 (전체 루프가 중단되지 않도록 방지)
                log.error("[SwissMatchMaker] Redis 전송 실패 - matchId: {}", match.getId(), e);
            }
        }
    }

    public void aggregateAndSave(Long contestId) {
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