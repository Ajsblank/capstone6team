package com.asap.server.service;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleMatch;
import com.asap.server.domain.CodeBattleParticipant;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.CodeBattleParticipantRepository;
import com.asap.server.repository.CodeBattleMatchRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.transaction.annotation.Transactional;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;
import java.util.TimeZone;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

@Slf4j
@Service
@RequiredArgsConstructor
public class CodeBattleContestSchedulerService {

    private final TaskScheduler taskScheduler;
    private final SwissMatchMaker swissMatchMaker;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final CodeBattleContestRepository contestRepository;
    private final CodeBattleParticipantRepository participantRepository;
    private final CodeBattleMatchRepository matchRepository;
    
    private static final String CODE_BATTLE_GRADING_QUEUE_KEY = "code_battle_grading_queue";

    // 예약된 스케줄을 관리하는 맵 (대회ID를 키로 사용)
    private final Map<Long, ScheduledFuture<?>> scheduledTasks = new ConcurrentHashMap<>();

    public void scheduleContestMatching(Long contestId, LocalDateTime startTime) {
        Runnable task = () -> processMatching(contestId);

        Instant instant = startTime.atZone(ZoneId.of("Asia/Seoul")).toInstant();
        ScheduledFuture<?> scheduledTask = taskScheduler.schedule(task, instant);

        if (scheduledTasks.containsKey(contestId)) {
            scheduledTasks.get(contestId).cancel(false);
        }
        scheduledTasks.put(contestId, scheduledTask);
        
        log.info("[Scheduler] 대회 ID {}의 매칭이 {}로 예약되었습니다.", contestId, startTime);
    }

    @PostConstruct
    public void initTemporarySchedules() {
        Runnable task = () -> processMatching(1l);

        taskScheduler.schedule(task, new CronTrigger("0 0 15 * * *", TimeZone.getTimeZone("Asia/Seoul")));
        taskScheduler.schedule(task, new CronTrigger("0 0 21 * * *", TimeZone.getTimeZone("Asia/Seoul")));
        
        log.info("[Scheduler] 임시 3시, 9시 정기 매칭 스케줄이 등록되었습니다.");
    }

    @Transactional
    private void processMatching(Long contestId) {
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
            swissMatchMaker.generateNextRound(contestId);

        } catch (Exception e) {
            log.error("[Scheduler] 에러 발생", e);
        } finally {
            scheduledTasks.remove(contestId);
        }
    }
}