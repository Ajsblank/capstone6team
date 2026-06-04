package com.asap.server.service;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleExampleAI;
import com.asap.server.domain.CodeBattleMatch;
import com.asap.server.domain.CodeBattleParticipant;
import com.asap.server.domain.CodeBattleSampleCode;
import com.asap.server.domain.ContestReviewer;
import com.asap.server.domain.Users;
import com.asap.server.dto.request.CreateCertifiedContestRequest;
import com.asap.server.dto.request.CreateUncertifiedContestRequest;
import com.asap.server.dto.request.ExampleAiRequest;
import com.asap.server.dto.request.SampleCodeRequest;
import com.asap.server.dto.request.UpdateContestCertifiedRequest;
import com.asap.server.dto.request.UpdateContestRequest;
import com.asap.server.dto.request.ValidateContestRequest;
import com.asap.server.dto.response.CodeBattleAiMatchResult;
import com.asap.server.dto.response.CodeBattleMySubmissionResponse;
import com.asap.server.dto.response.ContestDetailResponse;
import com.asap.server.dto.response.ContestListResponse;
import com.asap.server.dto.response.ContestParticipantResponse;
import com.asap.server.dto.response.ContestResponse;
import com.asap.server.dto.response.ExampleAiResponse;
import com.asap.server.dto.response.SampleCodeResponse;
import com.asap.server.global.type.ContestStatus;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.CodeBattleExampleAIRepository;
import com.asap.server.repository.CodeBattleMatchRepository;
import com.asap.server.repository.CodeBattleParticipantRepository;
import com.asap.server.repository.CodeBattleSampleCodeRepository;
import com.asap.server.repository.ContestReviewerRepository;
import com.asap.server.repository.usersRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class ContestService {

    private final CodeBattleContestRepository contestRepository;
    private final CodeBattleExampleAIRepository exampleAIRepository;
    private final CodeBattleParticipantRepository participantRepository;
    private final ContestReviewerRepository reviewerRepository;
    private final usersRepository userRepository;
    private final ContestRunService contestRun;
    private final S3Service s3Service;
    private final ContestReviewerRepository contestReviewerRepository;
    private final CodeBattleMatchRepository matchRepository;
    private final CodeBattleSampleCodeRepository sampleCodeRepository;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    private static final String CODE_BATTLE_TEST_QUEUE_KEY = "code_battle_test_queue";

    /**
     * 비인증 대회 생성
     * POST /api/contests/create/uncertified
     */
    @Transactional(rollbackFor = Exception.class)
    public ContestResponse createUncertifiedContest(
            Long creatorId,
            CreateUncertifiedContestRequest request) throws IOException {

        // 사용자 조회
        Users creator = userRepository.findById(creatorId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        LocalDateTime now = LocalDateTime.now();

        DatePolicy policy = resolveDatePolicyForCreate(
                request.getStatus(),
                request.getStartDate(),
                request.getEndDate(),
                now);

        if (!Boolean.FALSE.equals(request.getCertification())) {
            throw new IllegalArgumentException("비인증 대회는 certification=false 여야 합니다.");
        }

        if (request.getSampleCodes() == null || request.getSampleCodes().isEmpty()
                || request.getJudgeCode() == null || request.getJudgeCode().isBlank()
                || request.getExampleAiCodes() == null || request.getExampleAiCodes().isEmpty()) {
            throw new IllegalArgumentException(
                    "비인증 대회 생성 시 sampleCode, judgeCode, exampleAiCodes(1개 이상)가 필요합니다. visualizationHtml과 soloPlayHtml은 선택 사항입니다.");
        }

        CodeBattleContest contest = CodeBattleContest.create(
                request.getTitle(),
                request.getDescription(),
                request.getStatus(),
                false, // certification = false for uncertified contest
                request.getTimeLimitSec(),
                request.getMemoryLimitMb(),
                request.getJudgeCode(),
                request.getMaxParticipants(),
                policy.startDate(),
                policy.endDate(),
                request.getVisualizationHtml(),
                request.getSoloPlayHtml(),
                creator);

        CodeBattleContest savedContest = contestRepository.save(contest);

        saveExampleAiCodes(savedContest, request.getExampleAiCodes());
        saveSampleCodes(savedContest, request.getSampleCodes());

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    contestRun.registerContest(savedContest);
                }
            });
        } else {
            contestRun.registerContest(savedContest);
        }
        List<ExampleAiResponse> exampleAiCodes = request.getExampleAiCodes().stream()
                .map(e -> ExampleAiResponse.builder()
                        .code(e.getCode())
                        .description(e.getDescription())
                        .language(e.getLanguage())
                        .build())
                .toList();
        List<SampleCodeResponse> sampleCodes = request.getSampleCodes().stream()
                .map(s -> SampleCodeResponse.builder()
                        .code(s.getCode())
                        .language(s.getLanguage())
                        .build())
                .toList();
        return ContestResponse.from(savedContest, exampleAiCodes, sampleCodes);
    }

    /**
     * 인증 대회 생성
     * POST /api/contests/create/certified
     */
    @Transactional(rollbackFor = Exception.class)
    public ContestResponse createCertifiedContest(
            Long creatorId,
            CreateCertifiedContestRequest request) throws IOException {

        // 사용자 조회
        Users creator = userRepository.findById(creatorId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        if (!Boolean.TRUE.equals(request.getCertification())) {
            throw new IllegalArgumentException("인증 대회는 certification=true 여야 합니다.");
        }

        if (request.getVisualizationHtml() == null || request.getVisualizationHtml().isBlank()
                || request.getSoloPlayHtml() == null || request.getSoloPlayHtml().isBlank()) {
            throw new IllegalArgumentException("인증 대회는 visualizationHtml과 soloPlayHtml이 필수입니다.");
        }

        if (request.getSampleCodes() == null || request.getSampleCodes().isEmpty()
                || request.getJudgeCode() == null || request.getJudgeCode().isBlank()
                || request.getExampleAiCodes() == null || request.getExampleAiCodes().isEmpty()) {
            throw new IllegalArgumentException(
                    "인증 대회 생성 시 sampleCode, judgeCode, exampleAiCodes(1개 이상)가 모두 필요합니다.");
        }

        LocalDateTime now = LocalDateTime.now();

        DatePolicy policy = resolveDatePolicyForCreate(
                request.getStatus(),
                request.getStartDate(),
                request.getEndDate(),
                now);

        CodeBattleContest contest = CodeBattleContest.create(
                request.getTitle(),
                request.getDescription(),
                request.getStatus(),
                true, // certification = true for certified contest
                request.getTimeLimitSec(),
                request.getMemoryLimitMb(),
                request.getJudgeCode(),
                request.getMaxParticipants(),
                policy.startDate(),
                policy.endDate(),
                request.getVisualizationHtml(),
                request.getSoloPlayHtml(),
                creator);

        CodeBattleContest savedContest = contestRepository.save(contest);

        // 검수자 정보 저장
        List<String> reviewerEmails = request.getReviewerEmails();
        if (reviewerEmails != null && !reviewerEmails.isEmpty()) {
            for (String email : reviewerEmails) {
                if (email != null && !email.trim().isEmpty()) {
                    ContestReviewer reviewer = ContestReviewer.create(savedContest, email.trim());
                    reviewerRepository.save(reviewer);
                }
            }
        }

        saveExampleAiCodes(savedContest, request.getExampleAiCodes());
        saveSampleCodes(savedContest, request.getSampleCodes());

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    contestRun.registerContest(savedContest);
                }
            });
        } else {
            contestRun.registerContest(savedContest);
        }
        List<ExampleAiResponse> exampleAiCodes = request.getExampleAiCodes().stream()
                .map(e -> ExampleAiResponse.builder()
                        .code(e.getCode())
                        .description(e.getDescription())
                        .language(e.getLanguage())
                        .build())
                .toList();
        List<SampleCodeResponse> sampleCodes = request.getSampleCodes().stream()
                .map(s -> SampleCodeResponse.builder()
                        .code(s.getCode())
                        .language(s.getLanguage())
                        .build())
                .toList();
        return ContestResponse.from(savedContest, exampleAiCodes, sampleCodes);
    }

    private void saveExampleAiCodes(CodeBattleContest contest, List<ExampleAiRequest> exampleAiCodes) {
        List<CodeBattleExampleAI> entities = new ArrayList<>();
        Long order = 1L;
        for (ExampleAiRequest request : exampleAiCodes) {
            entities.add(new CodeBattleExampleAI(contest, order, request.getDescription(), request.getCode()));
            order++;
        }
        exampleAIRepository.saveAll(entities);
    }

    private void saveSampleCodes(CodeBattleContest contest, List<SampleCodeRequest> sampleCodes) {
        List<CodeBattleSampleCode> entities = new ArrayList<>();
        Long order = 1L;
        for (SampleCodeRequest sampleCode : sampleCodes) {
            entities.add(new CodeBattleSampleCode(contest, order, sampleCode.getCode(), sampleCode.getLanguage()));
            order++;
        }
        sampleCodeRepository.saveAll(entities);
    }

    @Transactional(readOnly = true)
    public ContestResponse getContestResponse(Long contestId) {
        CodeBattleContest contest = getContestById(contestId);
        return ContestResponse.from(contest, getExampleAiCodes(contestId), getSampleCodes(contestId));
    }

    @Transactional(readOnly = true)
    public ContestDetailResponse getContestDetailResponse(Long contestId) {
        CodeBattleContest contest = getContestById(contestId);
        return ContestDetailResponse.from(contest, getExampleAiCodes(contestId), getSampleCodes(contestId));
    }

    private List<ExampleAiResponse> getExampleAiCodes(Long contestId) {
        return exampleAIRepository.findByContestIdOrderByExampleOrderAsc(contestId)
                .stream()
                .map(e -> ExampleAiResponse.builder()
                        .code(e.getCode())
                        .description(e.getDescription())
                        .language(e.getLanguage())
                        .build())
                .toList();
    }

    private List<SampleCodeResponse> getSampleCodes(Long contestId) {
        return sampleCodeRepository.findByContestIdOrderBySampleOrderAsc(contestId)
                .stream()
                .map(s -> SampleCodeResponse.builder()
                        .code(s.getCode())
                        .language(s.getLanguage())
                        .build())
                .toList();
    }

    @Transactional
    public ContestDetailResponse updateContest(Long contestId, UpdateContestRequest request) {
        CodeBattleContest contest = contestRepository.findById(contestId)
                .orElseThrow(() -> new IllegalArgumentException("대회를 찾을 수 없습니다."));

        // 시간 수정 후 대회 상태를 갱신하는 로직 필요
        LocalDateTime now = LocalDateTime.now();
        boolean hasSchedulePatch = request.getStartDate() != null || request.getEndDate() != null;

        // 대회 시간 갱신
        LocalDateTime startDate = request.getStartDate() != null
                ? request.getStartDate()
                : contest.getStartDate();

        LocalDateTime endDate = request.getEndDate() != null
                ? request.getEndDate()
                : contest.getEndDate();

        // 필드 갱신 -- NULL 일 때 바꾸면 안됨
        contest.updateContestFields(
                trimToNull(request.getTitle()),
                trimToNull(request.getDescription()),
                request.getTimeLimitSec(),
                request.getMemoryLimitMb(),
                null,
                null,
                request.getMaxParticipants());

        if (hasSchedulePatch) {
            ContestStatus calculatedStatus = resolveStatus(startDate, endDate, now);
            contest.updateStatusAndSchedule(calculatedStatus, startDate, endDate);
            registerScheduleAfterCommit(contest);
        }

        return ContestDetailResponse.from(contest, getExampleAiCodes(contestId), getSampleCodes(contestId));
    }

    // 메소드 오버라이드, 인증 대회용
    @Transactional
    public ContestDetailResponse updateContest(Long contestId, UpdateContestCertifiedRequest request) {
        CodeBattleContest contest = contestRepository.findById(contestId)
                .orElseThrow(() -> new IllegalArgumentException("대회를 찾을 수 없습니다."));

        // 시간 수정 후 대회 상태를 갱신하는 로직 필요
        LocalDateTime now = LocalDateTime.now();
        boolean hasSchedulePatch = request.getStartDate() != null || request.getEndDate() != null;

        // 대회 시간 갱신
        LocalDateTime startDate = request.getStartDate() != null
                ? request.getStartDate()
                : contest.getStartDate();

        LocalDateTime endDate = request.getEndDate() != null
                ? request.getEndDate()
                : contest.getEndDate();

        // 필드 갱신 -- NULL 일 때 바꾸면 안됨
        contest.updateContestFields(
                trimToNull(request.getTitle()),
                trimToNull(request.getDescription()),
                request.getTimeLimitSec(),
                request.getMemoryLimitMb(),
                null,
                null,
                request.getMaxParticipants());
        // 검수자 이메일 별도 처리
        if (request.getReviewerEmails() != null && !request.getReviewerEmails().isEmpty()) {
            // 기존 검수자 삭제 후 새로 등록
            contestReviewerRepository.deleteByContestId(contest.getId());
            request.getReviewerEmails().forEach(email -> {
                ContestReviewer reviewer = ContestReviewer.create(contest, email);
                contestReviewerRepository.save(reviewer);
            });
        }
        if (hasSchedulePatch) {
            ContestStatus calculatedStatus = resolveStatus(startDate, endDate, now);
            contest.updateStatusAndSchedule(calculatedStatus, startDate, endDate);
            registerScheduleAfterCommit(contest);
        }

        return ContestDetailResponse.from(contest, getExampleAiCodes(contestId), getSampleCodes(contestId));
    }

    private ContestStatus resolveStatus(LocalDateTime startDate, LocalDateTime endDate, LocalDateTime now) {
        if (startDate == null || endDate == null)
            return ContestStatus.CANCELED; // CANCELLED 가 맞는 철자, 현재 비정상 상태를 반영
        if (now.isBefore(startDate))
            return ContestStatus.PLANNED;
        if (now.isAfter(endDate))
            return ContestStatus.END;
        return ContestStatus.RUNNING;
    }

    private void scheduleIfPlanned(CodeBattleContest contest) {
        switch (contest.getStatus()) {
            case PLANNED -> {
                if (contest.getStartDate() != null && contest.getEndDate() != null) {
                    contestRun.upsertContestSchedule(contest); // 기존 있으면 덮어쓰기, 없으면 등록
                }
            }
            case RUNNING, END -> {
                contestRun.cancelContestSchedule(contest.getId()); // 스케줄 제거
            }
            default -> {
            } // 그 외 상태는 무시
        }
    }

    private void registerScheduleAfterCommit(CodeBattleContest contest) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    scheduleIfPlanned(contest);
                }
            });
        } else {
            scheduleIfPlanned(contest);
        }
    }

    @Transactional(readOnly = true)
    public Page<ContestListResponse> getContestPage(ContestStatus status, Pageable pageable) {
        if (status != null) {
            return contestRepository.findByStatusAndDeletedAtIsNull(status, pageable)
                    .map(ContestListResponse::from);
        }
        return contestRepository.findAllByDeletedAtIsNull(pageable)
                .map(ContestListResponse::from);
    }

    @Transactional(readOnly = true)
    public CodeBattleContest getContestById(Long contestId) {
        return contestRepository.findById(contestId)
                .orElseThrow(() -> new IllegalArgumentException("해당 ID의 대회를 찾을 수 없습니다: " + contestId));
    }

    @Transactional
    public void joinContest(Long contestId, String email) {
        CodeBattleContest contest = getContestById(contestId);
        validateJoinableContestStatus(contest.getStatus());

        Users user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        if (participantRepository.existsByUserIdAndContestId(user.getId(), contestId)) {
            throw new IllegalArgumentException("이미 참가 신청한 대회입니다.");
        }

        long currentParticipants = participantRepository.countByContestId(contestId);
        if (currentParticipants >= contest.getMaxParticipants()) {
            throw new IllegalArgumentException("대회 최대 참가자 수를 초과했습니다.");
        }

        CodeBattleParticipant participant = new CodeBattleParticipant(user, contest, 0, null);
        participantRepository.save(participant);
    }

    @Transactional
    public void cancelJoinContest(Long contestId, String email) {
        Users user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        CodeBattleParticipant participant = participantRepository.findByUserIdAndContestId(user.getId(), contestId)
                .orElseThrow(() -> new IllegalArgumentException("참가 신청 내역이 없습니다."));

        participantRepository.delete(participant);
    }

    @Transactional(readOnly = true)
    public Page<ContestParticipantResponse> getContestParticipants(Long contestId, Pageable pageable) {
        getContestById(contestId);

        return participantRepository.findAllByContestId(contestId, pageable)
                .map(ContestParticipantResponse::from);
    }

    private void validateJoinableContestStatus(ContestStatus status) {
        if (status == ContestStatus.END || status == ContestStatus.CANCELED) {
            throw new IllegalArgumentException("종료되거나 취소된 대회에는 참가할 수 없습니다.");
        }
    }

    private DatePolicy resolveDatePolicyForCreate(
            ContestStatus status,
            LocalDateTime startDate,
            LocalDateTime endDate,
            LocalDateTime now) {

        if (status == ContestStatus.TEST) {
            // TEST는 일정 무시
            return new DatePolicy(null, null);
        }

        validateDatePair(startDate, endDate);
        validateStatusByPeriod(status, startDate, endDate, now);
        return new DatePolicy(startDate, endDate);
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private void validateDatePair(LocalDateTime startDate, LocalDateTime endDate) {
        if (startDate == null || endDate == null) {
            throw new IllegalArgumentException("TEST 상태가 아니면 시작/종료 날짜는 필수입니다.");
        }
        if (!startDate.isBefore(endDate)) {
            throw new IllegalArgumentException("startDate는 endDate보다 이전이어야 합니다.");
        }
    }

    private void validateStatusByPeriod(
            ContestStatus status,
            LocalDateTime startDate,
            LocalDateTime endDate,
            LocalDateTime now) {

        switch (status) {
            case PLANNED -> {
                if (!now.isBefore(startDate)) {
                    throw new IllegalArgumentException("PLANNED는 대회 시작 전일 때만 가능합니다.");
                }
            }
            case RUNNING, PAUSED -> {
                boolean inRange = !now.isBefore(startDate) && !now.isAfter(endDate);
                if (!inRange) {
                    throw new IllegalArgumentException("RUNNING/PAUSED는 대회 기간 중일 때만 가능합니다.");
                }
            }
            case END -> {
                if (!now.isAfter(endDate)) {
                    throw new IllegalArgumentException("END는 대회 종료 후일 때만 가능합니다.");
                }
            }
            case CANCELED -> {
                // 취소 상태는 기간 제약 없이 허용한다.
            }
            case TEST -> {
                // handled before
            }
        }
    }

    public void validateContestCodes(Long userId, ValidateContestRequest req) {
        String pendingKey = "validate:" + userId + ":pending";
        String logsKey    = "validate:" + userId + ":logs";
        String labelsKey  = "validate:" + userId + ":labels";

        if (Boolean.TRUE.equals(redisTemplate.hasKey(pendingKey))) {
            throw new IllegalStateException("이미 진행 중인 검증 요청이 있습니다. 완료 후 다시 시도해주세요.");
        }

        SampleCodeRequest skeleton = req.getSampleCodes().get(0);
        String skeletonLang = skeleton.getLanguage().name().toLowerCase();
        int jobCount = 1 + req.getExampleAiCodes().size();

        redisTemplate.delete(logsKey);
        redisTemplate.delete(labelsKey);
        redisTemplate.opsForValue().set(pendingKey, String.valueOf(jobCount), 10, java.util.concurrent.TimeUnit.MINUTES);

        try {
            // 1) judge vs skeleton × skeleton — judge + 스켈레톤 코드 검증
            redisTemplate.opsForList().leftPush(labelsKey, "샘플 코드");
            pushTestJob(userId, req.getJudgeCode(),
                    skeleton.getCode(), skeletonLang,
                    skeleton.getCode(), skeletonLang);

            // 2) judge vs skeleton × exampleAi[i] — 각 AI 코드 검증
            List<ExampleAiRequest> aiCodes = req.getExampleAiCodes();
            for (int i = 0; i < aiCodes.size(); i++) {
                ExampleAiRequest ai = aiCodes.get(i);
                redisTemplate.opsForList().leftPush(labelsKey, "Example AI " + (i + 1) + "번");
                pushTestJob(userId, req.getJudgeCode(),
                        skeleton.getCode(), skeletonLang,
                        ai.getCode(), ai.getLanguage().name().toLowerCase());
            }
            redisTemplate.expire(labelsKey, 10, java.util.concurrent.TimeUnit.MINUTES);
        } catch (JsonProcessingException e) {
            redisTemplate.delete(pendingKey);
            redisTemplate.delete(logsKey);
            redisTemplate.delete(labelsKey);
            throw new IllegalStateException("검증 요청 직렬화 실패", e);
        }

        log.info("[검증] userId={} 검증 요청 {}건 큐 적재 완료", userId, jobCount);
    }

    private void pushTestJob(Long userId,
                             String judgeCode,
                             String p1Code, String p1Lang,
                             String p2Code, String p2Lang) throws JsonProcessingException {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("userId", userId);
        payload.put("judge", judgeCode);
        payload.put("player1", p1Code);
        payload.put("player2", p2Code);

        ObjectNode languages = payload.putObject("languages");
        languages.put("judge", "cpp");
        languages.put("player1", p1Lang);
        languages.put("player2", p2Lang);

        redisTemplate.opsForList().leftPush(CODE_BATTLE_TEST_QUEUE_KEY, objectMapper.writeValueAsString(payload));
    }

    private record DatePolicy(LocalDateTime startDate, LocalDateTime endDate) {
    }

    @Transactional(readOnly = true)
    public List<CodeBattleMySubmissionResponse> getMySubmissionsWithAi(Long contestId, Long userId) {

        // 해당 유저가 AI와 진행한 모든 매치 기록 조회
        List<CodeBattleMatch> matches = matchRepository.findByContestIdAndUser1Id(contestId, userId);
        System.out.println("조회 시도 - contestId: " + contestId + ", userId: " + userId);

        return matches.stream()
                .filter(match -> match.getSubmission() != null)
                .map(match -> {
                    CodeBattleAiMatchResult aiResult = CodeBattleAiMatchResult.from(match, userId);

                    return CodeBattleMySubmissionResponse.of(match.getSubmission(), aiResult);
                })
                .collect(Collectors.toList());
    }
}
