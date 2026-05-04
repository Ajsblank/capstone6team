package com.asap.server.service;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleMatch;
import com.asap.server.domain.CodeBattleParticipant;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.CodeBattleMatchRepository;
import com.asap.server.repository.CodeBattleParticipantRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Component
public class SwissMatchMaker {

    private final CodeBattleContestRepository contestRepository;
    private final CodeBattleParticipantRepository participantRepository;
    private final CodeBattleMatchRepository matchRepository;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redisTemplate;
    
    private static final String CODE_BATTLE_GRADING_QUEUE_KEY = "code_battle_grading_queue";

    public SwissMatchMaker(CodeBattleContestRepository contestRepository,
                           CodeBattleParticipantRepository participantRepository,
                           CodeBattleMatchRepository matchRepository,
                           ObjectMapper objectMapper,
                           StringRedisTemplate redisTemplate) {
        this.contestRepository = contestRepository;
        this.participantRepository = participantRepository;
        this.matchRepository = matchRepository;
        this.objectMapper = objectMapper;
        this.redisTemplate = redisTemplate;
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
                (CodeBattleParticipant p) -> p.getScore() == null ? 0 : p.getScore()
        ).reversed());

        // 2명씩 짝지어서 매치 엔티티 생성
        for (int i = 0; i < sortedParticipants.size() - 1; i += 2) {
            CodeBattleParticipant p1 = sortedParticipants.get(i);
            CodeBattleParticipant p2 = sortedParticipants.get(i + 1);

            CodeBattleMatch match = new CodeBattleMatch(
                    contest,
                    p1.getUser(),
                    p2.getUser(),
                    null, // winner
                    null  // log
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
                (CodeBattleParticipant p) -> p.getScore() == null ? 0 : p.getScore()
        ).reversed());

        List<CodeBattleMatch> matches = new ArrayList<>();
        
        // 2명씩 짝짓기 (엔티티 수정 안 함)
        for (int i = 0; i < participants.size() - 1; i += 2) {
            CodeBattleMatch match = new CodeBattleMatch(
                    contest,
                    participants.get(i).getUser(),
                    participants.get(i + 1).getUser(),
                    null, // winner
                    null  // log
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
                rootNode.put("matchId", match.getId());
                rootNode.put("timeLimitSec", contest.getTimeLimitSec());
                rootNode.put("memoryLimitMb", contest.getMemoryLimitMB());

                ObjectNode codesNode = rootNode.putObject("codes");
                codesNode.put("judge", contest.getJudgeCode());
                codesNode.put("player1", p1.getSubmission().getCode());
                codesNode.put("player2", p2.getSubmission().getCode());

                String jsonPayload = objectMapper.writeValueAsString(rootNode);
                
                // Redis에 왼쪽(Left)으로 Push (List 자료구조)
                redisTemplate.opsForList().leftPush(CODE_BATTLE_GRADING_QUEUE_KEY, jsonPayload);
                
            } catch (Exception e) {
                // 특정 매치 JSON 생성/전송 실패 시 에러 로깅 (전체 루프가 중단되지 않도록 방지)
                log.error("[SwissMatchMaker] Redis 전송 실패 - matchId: {}", match.getId(), e);
            }
        }
    }
}