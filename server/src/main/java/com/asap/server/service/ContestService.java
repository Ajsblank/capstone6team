package com.asap.server.service;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

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
import com.asap.server.global.type.Language;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.CodeBattleExampleAIRepository;
import com.asap.server.repository.CodeBattleMatchRepository;
import com.asap.server.repository.CodeBattleParticipantRepository;
import com.asap.server.repository.CodeBattleSampleCodeRepository;
import com.asap.server.repository.ContestReviewerRepository;
import com.asap.server.repository.usersRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

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
    private final ContestReviewerRepository contestReviewerRepository;
    private final CodeBattleMatchRepository matchRepository;
    private final CodeBattleSampleCodeRepository sampleCodeRepository;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    private static final String CODE_BATTLE_TEST_QUEUE_KEY = "code_battle_test_queue";

    // 의도적으로 오류를 발생시키는 probe 코드 — judge가 각 에러 상황을 올바르게 처리하는지 검증
    private static final Map<Language, String> RUNTIME_ERROR_PROBE = Map.of(
            Language.CPP, "int main(){int*p=nullptr;*p=1;return 0;}",
            Language.JAVA, "public class Main{public static void main(String[]a){throw new RuntimeException();}}",
            Language.PYTHON, "raise RuntimeError()",
            Language.C, "int main(){int*p=0;*p=1;return 0;}");

    private static final Map<Language, String> COMPILE_ERROR_PROBE = Map.of(
            Language.CPP, "int main(){thisisnotvalidcpp",
            Language.JAVA, "public class Main{public static void",
            Language.PYTHON, "def f(:",
            Language.C, "int main(){thisisnotvalidc");

    // TLE probe: READY/INIT/OPP는 정상 처리하고 TIME 명령을 받으면 무한루프 → judge가 TIME_LIMIT 판정해야
    // 함
    // (단순 while(true)는 READY에 OK도 안 보내 RUNTIME_ERROR로 오판됨)
    private static final Map<Language, String> TLE_PROBE = Map.of(
            Language.CPP,
            "#include<iostream>\n#include<string>\nusing namespace std;\n"
                    + "int main(){\n"
                    + "  string line;\n"
                    + "  while(getline(cin,line)){\n"
                    + "    if(line.find(\"READY\")==0){cout<<\"OK\"<<endl;}\n"
                    + "    else if(line.find(\"TIME\")==0){while(true){}}\n"
                    + "  }\n"
                    + "}",
            Language.JAVA,
            "import java.util.Scanner;\n"
                    + "public class Main{\n"
                    + "  public static void main(String[]a)throws Exception{\n"
                    + "    Scanner sc=new Scanner(System.in);\n"
                    + "    while(sc.hasNextLine()){\n"
                    + "      String line=sc.nextLine();\n"
                    + "      if(line.startsWith(\"READY\")){System.out.println(\"OK\");System.out.flush();}\n"
                    + "      else if(line.startsWith(\"TIME\")){while(true){}}\n"
                    + "    }\n"
                    + "  }\n"
                    + "}",
            Language.PYTHON,
            "import sys\n"
                    + "for line in sys.stdin:\n"
                    + "    line=line.strip()\n"
                    + "    if line.startswith('READY'):\n"
                    + "        print('OK',flush=True)\n"
                    + "    elif line.startswith('TIME'):\n"
                    + "        while True:pass\n",
            Language.C,
            "#include<stdio.h>\n#include<string.h>\n"
                    + "int main(){\n"
                    + "  char buf[256];\n"
                    + "  while(fgets(buf,sizeof(buf),stdin)){\n"
                    + "    if(strncmp(buf,\"READY\",5)==0){printf(\"OK\\n\");fflush(stdout);}\n"
                    + "    else if(strncmp(buf,\"TIME\",4)==0){while(1){}}\n"
                    + "  }\n"
                    + "  return 0;\n"
                    + "}");

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
                request.getJudgeLanguage(),
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
                request.getJudgeLanguage(),
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
        String labelsKey = "validate:" + userId + ":labels";
        String resultsKey = "validate:" + userId + ":results";
        String probeTypesKey = "validate:" + userId + ":probe_types";
        String queuedJobsKey = "validate:" + userId + ":queued_jobs"; // Phase 2 대기 잡 목록

        if (Boolean.TRUE.equals(redisTemplate.hasKey(pendingKey))) {
            throw new IllegalStateException("이미 진행 중인 검증 요청이 있습니다. 완료 후 다시 시도해주세요.");
        }

        SampleCodeRequest skeleton = req.getSampleCodes().get(0);
        Language sampleLang = skeleton.getLanguage();
        String skeletonLang = sampleLang.name().toLowerCase();
        List<ExampleAiRequest> aiCodes = req.getExampleAiCodes();

        redisTemplate.delete(labelsKey);
        redisTemplate.delete(resultsKey);
        redisTemplate.delete(probeTypesKey);
        redisTemplate.delete(queuedJobsKey);

        // Phase 1: smoke test 1건만 대기
        redisTemplate.opsForValue().set(pendingKey, "1", 10, java.util.concurrent.TimeUnit.MINUTES);

        try {
            // ── 실제 검증 잡 미리 직렬화 → Redis 임시 목록에 보관 (Phase 2에서 제출) ──

            // Job 0: judge vs 샘플 × 샘플
            String jobId0 = userId + "_0";
            redisTemplate.opsForHash().put(labelsKey, jobId0, "샘플 코드");
            redisTemplate.opsForList().rightPush(queuedJobsKey,
                    buildTestJobJson(jobId0, userId, req.getJudgeCode(),
                            skeleton.getCode(), skeletonLang,
                            skeleton.getCode(), skeletonLang));

            // Jobs 1+: judge vs 샘플 × exampleAi[i]
            for (int i = 0; i < aiCodes.size(); i++) {
                ExampleAiRequest ai = aiCodes.get(i);
                String jobId = userId + "_" + (i + 1);
                redisTemplate.opsForHash().put(labelsKey, jobId, "Example AI " + (i + 1) + "번");
                redisTemplate.opsForList().rightPush(queuedJobsKey,
                        buildTestJobJson(jobId, userId, req.getJudgeCode(),
                                skeleton.getCode(), skeletonLang,
                                ai.getCode(), ai.getLanguage().name().toLowerCase()));
            }

            // Probe jobs
            int probeBase = 1 + aiCodes.size();

            String rteJobId = userId + "_" + probeBase;
            redisTemplate.opsForHash().put(labelsKey, rteJobId, "런타임 에러 처리 검증");
            redisTemplate.opsForHash().put(probeTypesKey, rteJobId, "RUNTIME_ERROR");
            redisTemplate.opsForList().rightPush(queuedJobsKey,
                    buildTestJobJson(rteJobId, userId, req.getJudgeCode(),
                            skeleton.getCode(), skeletonLang,
                            RUNTIME_ERROR_PROBE.get(sampleLang), skeletonLang));

            String ceJobId = userId + "_" + (probeBase + 1);
            redisTemplate.opsForHash().put(labelsKey, ceJobId, "컴파일 에러 처리 검증");
            redisTemplate.opsForHash().put(probeTypesKey, ceJobId, "COMPILE_ERROR");
            redisTemplate.opsForList().rightPush(queuedJobsKey,
                    buildTestJobJson(ceJobId, userId, req.getJudgeCode(),
                            skeleton.getCode(), skeletonLang,
                            COMPILE_ERROR_PROBE.get(sampleLang), skeletonLang));

            String tleJobId = userId + "_" + (probeBase + 2);
            redisTemplate.opsForHash().put(labelsKey, tleJobId, "시간 초과 처리 검증");
            redisTemplate.opsForHash().put(probeTypesKey, tleJobId, "TIME_LIMIT");
            redisTemplate.opsForList().rightPush(queuedJobsKey,
                    buildTestJobJson(tleJobId, userId, req.getJudgeCode(),
                            skeleton.getCode(), skeletonLang,
                            TLE_PROBE.get(sampleLang), skeletonLang));

            redisTemplate.expire(queuedJobsKey, 10, java.util.concurrent.TimeUnit.MINUTES);
            redisTemplate.expire(labelsKey, 10, java.util.concurrent.TimeUnit.MINUTES);
            redisTemplate.expire(resultsKey, 10, java.util.concurrent.TimeUnit.MINUTES);
            redisTemplate.expire(probeTypesKey, 10, java.util.concurrent.TimeUnit.MINUTES);

            // ── Phase 1: smoke test 잡만 제출 ─────────────────────────────
            // 즉시 종료하는 Python 플레이어로 judge를 실행해 무한루프 여부를 판별.
            // timeoutSec=10: 정상 judge는 EOF 감지 후 수 초 내 종료, 무한루프는 10초 만에 탐지.
            String smokeJobId = userId + "_smoke";
            String smokePlayer = "import sys\nsys.exit(0)\n";
            pushSmokeJob(smokeJobId, userId, req.getJudgeCode(),
                    smokePlayer, "python", smokePlayer, "python");

        } catch (JsonProcessingException e) {
            redisTemplate.delete(java.util.List.of(pendingKey, labelsKey, resultsKey, probeTypesKey, queuedJobsKey));
            throw new IllegalStateException("검증 요청 직렬화 실패", e);
        }

        log.info("[검증] userId={} Phase 1: judge smoke test 제출", userId);
    }

    /** job JSON 직렬화만 수행 (큐에 넣지 않음) */
    private String buildTestJobJson(String jobId, Long userId,
            String judgeCode,
            String p1Code, String p1Lang,
            String p2Code, String p2Lang) throws JsonProcessingException {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("jobId", jobId);
        payload.put("userId", userId);
        payload.put("judge", judgeCode);
        payload.put("player1", p1Code);
        payload.put("player2", p2Code);
        ObjectNode languages = payload.putObject("languages");
        languages.put("judge", "cpp");
        languages.put("player1", p1Lang);
        languages.put("player2", p2Lang);
        return objectMapper.writeValueAsString(payload);
    }

    /** smoke test 전용: timeoutSec=10 으로 채점서버 타임아웃을 단축해 빠른 무한루프 탐지 */
    private void pushSmokeJob(String jobId, Long userId,
            String judgeCode,
            String p1Code, String p1Lang,
            String p2Code, String p2Lang) throws JsonProcessingException {
        ObjectNode payload = objectMapper.readValue(
                buildTestJobJson(jobId, userId, judgeCode, p1Code, p1Lang, p2Code, p2Lang),
                ObjectNode.class);
        payload.put("timeoutSec", 10);
        redisTemplate.opsForList().leftPush(CODE_BATTLE_TEST_QUEUE_KEY,
                objectMapper.writeValueAsString(payload));
    }

    private record DatePolicy(LocalDateTime startDate, LocalDateTime endDate) {
    }

    @Transactional(readOnly = true)
    public List<CodeBattleMySubmissionResponse> getMySubmissionsWithAi(Long contestId, Long userId) {

        // 해당 유저가 AI와 진행한 모든 매치 기록 조회
        List<CodeBattleMatch> matches = matchRepository.findByContestIdAndUser1Id(contestId, userId);
        log.info("조회 시도 - contestId: {}, userId: {}", contestId, userId);

        return matches.stream()
                .filter(match -> match.getSubmission() != null)
                .map(match -> {
                    CodeBattleAiMatchResult aiResult = CodeBattleAiMatchResult.from(match, userId);

                    return CodeBattleMySubmissionResponse.of(match.getSubmission(), aiResult);
                })
                .collect(Collectors.toList());
    }

    // 여기 구현
    @Transactional
    public void deleteContest(Long contestId) {
        CodeBattleContest contest = contestRepository.findById(contestId)
                .orElseThrow(() -> new IllegalArgumentException(
                        String.format("대회를 찾을 수 없습니다. 대회 ID = %d", contestId)));
        contestRepository.delete(contest);
        log.info("대회 ID = {} 삭제 완료", contestId);
    }
}
