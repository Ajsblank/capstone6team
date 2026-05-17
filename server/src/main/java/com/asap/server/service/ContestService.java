package com.asap.server.service;

import java.io.IOException;
import java.net.URI;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleExampleAI;
import com.asap.server.domain.CodeBattleParticipant;
import com.asap.server.domain.ContestReviewer;
import com.asap.server.domain.ContestSchedule;
import com.asap.server.domain.Users;
import com.asap.server.dto.request.ContestScheduleRequest;
import com.asap.server.dto.request.CreateCertifiedContestRequest;
import com.asap.server.dto.request.CreateContestRequest;
import com.asap.server.dto.request.CreateUncertifiedContestRequest;
import com.asap.server.dto.request.UpdateContestRequest;
import com.asap.server.dto.response.ContestDetailResponse;
import com.asap.server.dto.response.ContestListResponse;
import com.asap.server.dto.response.ContestParticipantResponse;
import com.asap.server.dto.response.ContestResponse;
import com.asap.server.global.type.ContestStatus;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.CodeBattleExampleAIRepository;
import com.asap.server.repository.CodeBattleParticipantRepository;
import com.asap.server.repository.ContestReviewerRepository;
import com.asap.server.repository.ContestScheduleRepository;
import com.asap.server.repository.usersRepository;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awssdk.services.s3.model.S3Exception;

@Service
@RequiredArgsConstructor
@Slf4j
public class ContestService {

    private static final String FIXED_SAMPLE_CODE_NAME = "sample_code";

    private final CodeBattleContestRepository contestRepository;
    private final CodeBattleExampleAIRepository exampleAIRepository;
    private final CodeBattleParticipantRepository participantRepository;
    private final ContestReviewerRepository reviewerRepository;
    private final usersRepository userRepository;
    private final ContestScheduleRepository contestScheduleRepository;
    private final ContestRunService contestRun;
    private final S3Service s3Service;

    @Transactional(rollbackFor = Exception.class)
    public ContestResponse createContest(
            Long userId,
            CreateContestRequest request,
            MultipartFile visualFile,
            MultipartFile soloFile,
            MultipartFile judgeCodeFile,
            MultipartFile sampleCodeFile,
            List<MultipartFile> exampleAiFiles) throws IOException {

        // 사용자 조회
        Users creator = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

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
                request.getCertification(),
                request.getTimeLimitSec(),
                request.getMemoryLimitMb(),
                null,
                null,
                request.getMaxParticipants(),
                policy.startDate(),
                policy.endDate(),
                null,
                null,
                creator);
        // 최종 대회 예약 생성

        CodeBattleContest savedContest = contestRepository.save(contest);

        List<MultipartFile> nonEmptyExampleAiFiles = filterNonEmptyFiles(exampleAiFiles);

        if (judgeCodeFile == null || judgeCodeFile.isEmpty()
                || sampleCodeFile == null || sampleCodeFile.isEmpty()
                || nonEmptyExampleAiFiles.isEmpty()) {
            throw new IllegalArgumentException(
                    "대회 생성 시 judge/sample 파일과 exampleAiFiles(1개 이상)가 필요합니다. visual/solo 파일은 선택 사항입니다.");
        }

        String resolvedSampleCodeName = FIXED_SAMPLE_CODE_NAME;

        boolean visualUploaded = false;
        boolean soloUploaded = false;
        boolean judgeUploaded = false;
        boolean sampleUploaded = false;
        List<String> uploadedExampleAiNames = new ArrayList<>();
        List<String> uploadedExampleAiUrls = new ArrayList<>();

        String visualUrl = null;
        String soloUrl = null;
        String judgeCodeUrl;
        String sampleCodeUrl;

        try {
            if (visualFile != null && !visualFile.isEmpty()) {
                visualUrl = s3Service.uploadContestResourceFile(
                        savedContest.getId(),
                        S3Service.ContestResourceType.VISUAL_HTML,
                        visualFile);
                visualUploaded = true;
            }

            if (soloFile != null && !soloFile.isEmpty()) {
                soloUrl = s3Service.uploadContestResourceFile(
                        savedContest.getId(),
                        S3Service.ContestResourceType.SOLO_HTML,
                        soloFile);
                soloUploaded = true;
            }

            judgeCodeUrl = s3Service.uploadJudgeCodeFile(savedContest.getId(), judgeCodeFile);
            judgeUploaded = true;

            sampleCodeUrl = s3Service.uploadSampleCodeFile(
                    savedContest.getId(),
                    resolvedSampleCodeName,
                    sampleCodeFile);
            sampleUploaded = true;

            int exampleOrder = 1;
            for (MultipartFile exampleAiFile : nonEmptyExampleAiFiles) {
                String exampleAiName = resolveExampleAiCodeName(exampleOrder);
                String exampleAiUrl = s3Service.uploadExampleAiCodeFile(savedContest.getId(), exampleAiName,
                        exampleAiFile);
                uploadedExampleAiNames.add(exampleAiName);
                uploadedExampleAiUrls.add(exampleAiUrl);
                exampleOrder++;
            }

            if (visualUrl != null) {
                savedContest.setVisualizationHtml(visualUrl);
            }
            if (soloUrl != null) {
                savedContest.setSoloPlayHtml(soloUrl);
            }
            savedContest.setJudgeCode(judgeCodeUrl);
            savedContest.setSampleCode(sampleCodeUrl);
            saveExampleAiCodes(savedContest, uploadedExampleAiUrls);
        } catch (Exception e) {
            rollbackUploadedResources(savedContest.getId(), resolvedSampleCodeName, uploadedExampleAiNames,
                    visualUploaded, soloUploaded, judgeUploaded, sampleUploaded);
            throw convertUploadException("대회 생성", e);
        }

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
        return ContestResponse.from(savedContest, uploadedExampleAiUrls);
    }

    /**
     * 비인증 대회 생성
     * POST /api/contests/create/uncertified
     */
    @Transactional(rollbackFor = Exception.class)
    public ContestResponse createUncertifiedContest(
            Long userId,
            CreateUncertifiedContestRequest request,
            MultipartFile visualFile,
            MultipartFile soloFile,
            MultipartFile judgeCodeFile,
            MultipartFile sampleCodeFile,
            List<MultipartFile> exampleAiFiles) throws IOException {

        // 사용자 조회
        Users creator = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

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
                false, // certification = false for uncertified contest
                request.getTimeLimitSec(),
                request.getMemoryLimitMb(),
                null,
                null,
                request.getMaxParticipants(),
                policy.startDate(),
                policy.endDate(),
                null,
                null,
                creator);

        CodeBattleContest savedContest = contestRepository.save(contest);

        List<MultipartFile> nonEmptyExampleAiFiles = filterNonEmptyFiles(exampleAiFiles);

        if (judgeCodeFile == null || judgeCodeFile.isEmpty()
                || sampleCodeFile == null || sampleCodeFile.isEmpty()
                || nonEmptyExampleAiFiles.isEmpty()) {
            throw new IllegalArgumentException(
                    "대회 생성 시 judge/sample 파일과 exampleAiFiles(1개 이상)가 필요합니다. visual/solo 파일은 선택 사항입니다.");
        }

        String resolvedSampleCodeName = FIXED_SAMPLE_CODE_NAME;

        boolean visualUploaded = false;
        boolean soloUploaded = false;
        boolean judgeUploaded = false;
        boolean sampleUploaded = false;
        List<String> uploadedExampleAiNames = new ArrayList<>();
        List<String> uploadedExampleAiUrls = new ArrayList<>();

        String visualUrl = null;
        String soloUrl = null;
        String judgeCodeUrl;
        String sampleCodeUrl;

        try {
            if (visualFile != null && !visualFile.isEmpty()) {
                visualUrl = s3Service.uploadContestResourceFile(
                        savedContest.getId(),
                        S3Service.ContestResourceType.VISUAL_HTML,
                        visualFile);
                visualUploaded = true;
            }

            if (soloFile != null && !soloFile.isEmpty()) {
                soloUrl = s3Service.uploadContestResourceFile(
                        savedContest.getId(),
                        S3Service.ContestResourceType.SOLO_HTML,
                        soloFile);
                soloUploaded = true;
            }

            judgeCodeUrl = s3Service.uploadJudgeCodeFile(savedContest.getId(), judgeCodeFile);
            judgeUploaded = true;

            sampleCodeUrl = s3Service.uploadSampleCodeFile(
                    savedContest.getId(),
                    resolvedSampleCodeName,
                    sampleCodeFile);
            sampleUploaded = true;

            int exampleOrder = 1;
            for (MultipartFile exampleAiFile : nonEmptyExampleAiFiles) {
                String exampleAiName = resolveExampleAiCodeName(exampleOrder);
                String exampleAiUrl = s3Service.uploadExampleAiCodeFile(savedContest.getId(), exampleAiName,
                        exampleAiFile);
                uploadedExampleAiNames.add(exampleAiName);
                uploadedExampleAiUrls.add(exampleAiUrl);
                exampleOrder++;
            }

            if (visualUrl != null) {
                savedContest.setVisualizationHtml(visualUrl);
            }
            if (soloUrl != null) {
                savedContest.setSoloPlayHtml(soloUrl);
            }
            savedContest.setJudgeCode(judgeCodeUrl);
            savedContest.setSampleCode(sampleCodeUrl);
            saveExampleAiCodes(savedContest, uploadedExampleAiUrls);
        } catch (Exception e) {
            rollbackUploadedResources(savedContest.getId(), resolvedSampleCodeName, uploadedExampleAiNames,
                    visualUploaded, soloUploaded, judgeUploaded, sampleUploaded);
            throw convertUploadException("비인증 대회 생성", e);
        }

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
        return ContestResponse.from(savedContest, uploadedExampleAiUrls);
    }

    /**
     * 인증 대회 생성
     * POST /api/contests/create/certified
     */
    @Transactional(rollbackFor = Exception.class)
    public ContestResponse createCertifiedContest(
            Long userId,
            CreateCertifiedContestRequest request,
            MultipartFile visualFile,
            MultipartFile soloFile,
            MultipartFile judgeCodeFile,
            MultipartFile sampleCodeFile,
            List<MultipartFile> exampleAiFiles) throws IOException {

        // 사용자 조회
        Users creator = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        // 인증 대회 - visualizationHtml과 soloPlayHtml은 필수
        if (visualFile == null || visualFile.isEmpty()
                || soloFile == null || soloFile.isEmpty()) {
            throw new IllegalArgumentException("인증 대회는 visualization HTML과 soloPlay HTML 파일이 필수입니다.");
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
                null,
                null,
                request.getMaxParticipants(),
                policy.startDate(),
                policy.endDate(),
                null,
                null,
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

        List<MultipartFile> nonEmptyExampleAiFiles = filterNonEmptyFiles(exampleAiFiles);

        if (judgeCodeFile == null || judgeCodeFile.isEmpty()
                || sampleCodeFile == null || sampleCodeFile.isEmpty()
                || nonEmptyExampleAiFiles.isEmpty()) {
            throw new IllegalArgumentException("인증 대회 생성 시 judge/sample 파일과 exampleAiFiles(1개 이상)가 모두 필요합니다.");
        }

        String resolvedSampleCodeName = FIXED_SAMPLE_CODE_NAME;

        boolean visualUploaded = false;
        boolean soloUploaded = false;
        boolean judgeUploaded = false;
        boolean sampleUploaded = false;
        List<String> uploadedExampleAiNames = new ArrayList<>();
        List<String> uploadedExampleAiUrls = new ArrayList<>();

        String visualUrl;
        String soloUrl;
        String judgeCodeUrl;
        String sampleCodeUrl;

        try {
            visualUrl = s3Service.uploadContestResourceFile(
                    savedContest.getId(),
                    S3Service.ContestResourceType.VISUAL_HTML,
                    visualFile);
            visualUploaded = true;

            soloUrl = s3Service.uploadContestResourceFile(
                    savedContest.getId(),
                    S3Service.ContestResourceType.SOLO_HTML,
                    soloFile);
            soloUploaded = true;

            judgeCodeUrl = s3Service.uploadJudgeCodeFile(savedContest.getId(), judgeCodeFile);
            judgeUploaded = true;

            sampleCodeUrl = s3Service.uploadSampleCodeFile(
                    savedContest.getId(),
                    resolvedSampleCodeName,
                    sampleCodeFile);
            sampleUploaded = true;

            int exampleOrder = 1;
            for (MultipartFile exampleAiFile : nonEmptyExampleAiFiles) {
                String exampleAiName = resolveExampleAiCodeName(exampleOrder);
                String exampleAiUrl = s3Service.uploadExampleAiCodeFile(savedContest.getId(), exampleAiName,
                        exampleAiFile);
                uploadedExampleAiNames.add(exampleAiName);
                uploadedExampleAiUrls.add(exampleAiUrl);
                exampleOrder++;
            }

            savedContest.setVisualizationHtml(visualUrl);
            savedContest.setSoloPlayHtml(soloUrl);
            savedContest.setJudgeCode(judgeCodeUrl);
            savedContest.setSampleCode(sampleCodeUrl);
            saveExampleAiCodes(savedContest, uploadedExampleAiUrls);
        } catch (Exception e) {
            rollbackUploadedResources(savedContest.getId(), resolvedSampleCodeName, uploadedExampleAiNames,
                    visualUploaded, soloUploaded, judgeUploaded, sampleUploaded);
            throw convertUploadException("인증 대회 생성", e);
        }

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
        return ContestResponse.from(savedContest, uploadedExampleAiUrls);
    }

    private void rollbackUploadedResources(
            Long contestId,
            String sampleCodeName,
            List<String> exampleAiCodeNames,
            boolean visualUploaded,
            boolean soloUploaded,
            boolean judgeUploaded,
            boolean sampleUploaded) {
        if (sampleUploaded) {
            try {
                s3Service.deleteSampleCodeFile(contestId, sampleCodeName);
            } catch (Exception ex) {
                log.warn("보상 삭제 실패 - sampleCode, contestId: {}", contestId, ex);
            }
        }
        for (String exampleAiCodeName : exampleAiCodeNames) {
            try {
                s3Service.deleteExampleAiCodeFile(contestId, exampleAiCodeName);
            } catch (Exception ex) {
                log.warn("보상 삭제 실패 - exampleAiCode, contestId: {}, name: {}", contestId, exampleAiCodeName, ex);
            }
        }
        if (judgeUploaded) {
            try {
                s3Service.deleteJudgeCodeFile(contestId);
            } catch (Exception ex) {
                log.warn("보상 삭제 실패 - judgeCode, contestId: {}", contestId, ex);
            }
        }
        if (soloUploaded) {
            try {
                s3Service.deleteContestResourceFile(contestId, S3Service.ContestResourceType.SOLO_HTML);
            } catch (Exception ex) {
                log.warn("보상 삭제 실패 - soloHtml, contestId: {}", contestId, ex);
            }
        }
        if (visualUploaded) {
            try {
                s3Service.deleteContestResourceFile(contestId, S3Service.ContestResourceType.VISUAL_HTML);
            } catch (Exception ex) {
                log.warn("보상 삭제 실패 - visualHtml, contestId: {}", contestId, ex);
            }
        }
    }

    @Transactional
    public ContestDetailResponse updateContestResources(
            Long contestId,
            MultipartFile visualFile,
            MultipartFile soloFile,
            MultipartFile judgeCodeFile,
            MultipartFile sampleCodeFile,
            List<MultipartFile> exampleAiFiles) throws IOException {
        CodeBattleContest contest = contestRepository.findById(contestId)
                .orElseThrow(() -> new IllegalArgumentException("해당 ID의 대회를 찾을 수 없습니다: " + contestId));

        if (visualFile != null && !visualFile.isEmpty()) {
            String visualUrl = s3Service.uploadContestResourceFile(contestId, S3Service.ContestResourceType.VISUAL_HTML,
                    visualFile);
            contest.setVisualizationHtml(visualUrl);
        }

        if (soloFile != null && !soloFile.isEmpty()) {
            String soloUrl = s3Service.uploadContestResourceFile(contestId, S3Service.ContestResourceType.SOLO_HTML,
                    soloFile);
            contest.setSoloPlayHtml(soloUrl);
        }

        if (judgeCodeFile != null && !judgeCodeFile.isEmpty()) {
            String judgeUrl = s3Service.uploadJudgeCodeFile(contestId, judgeCodeFile);
            contest.setJudgeCode(judgeUrl);
        }

        if (sampleCodeFile != null && !sampleCodeFile.isEmpty()) {
            String sampleUrl = s3Service.uploadSampleCodeFile(contestId, FIXED_SAMPLE_CODE_NAME, sampleCodeFile);
            contest.setSampleCode(sampleUrl);
        }

        List<MultipartFile> nonEmptyExampleAiFiles = filterNonEmptyFiles(exampleAiFiles);
        if (!nonEmptyExampleAiFiles.isEmpty()) {
            replaceExampleAiCodes(contest, nonEmptyExampleAiFiles);
        }

        return ContestDetailResponse.from(contest);
    }

    private void replaceExampleAiCodes(CodeBattleContest contest, List<MultipartFile> exampleAiFiles)
            throws IOException {
        List<String> uploadedNames = new ArrayList<>();
        List<String> uploadedUrls = new ArrayList<>();

        int exampleOrder = 1;
        try {
            for (MultipartFile exampleAiFile : exampleAiFiles) {
                String exampleAiName = resolveExampleAiCodeName(exampleOrder);
                String exampleAiUrl = s3Service.uploadExampleAiCodeFile(contest.getId(), exampleAiName, exampleAiFile);
                uploadedNames.add(exampleAiName);
                uploadedUrls.add(exampleAiUrl);
                exampleOrder++;
            }
        } catch (Exception e) {
            for (String uploadedName : uploadedNames) {
                try {
                    s3Service.deleteExampleAiCodeFile(contest.getId(), uploadedName);
                } catch (Exception ignored) {
                    log.warn("보상 삭제 실패 - exampleAiCode, contestId: {}, name: {}", contest.getId(), uploadedName,
                            ignored);
                }
            }
            throw new IllegalStateException("예제 AI 코드 업로드 실패", e);
        }

        List<CodeBattleExampleAI> existing = exampleAIRepository.findByContestIdOrderByExampleOrderAsc(contest.getId());
        for (CodeBattleExampleAI current : existing) {
            String key = extractS3Key(current.getCode());
            if (key != null && !key.isBlank()) {
                try {
                    s3Service.deleteObjectByKey(key);
                } catch (Exception ex) {
                    log.warn("기존 예제 AI 코드 삭제 실패 - contestId: {}, key: {}", contest.getId(), key, ex);
                }
            }
        }

        exampleAIRepository.deleteAll(existing);
        saveExampleAiCodes(contest, uploadedUrls);
    }

    private void saveExampleAiCodes(CodeBattleContest contest, List<String> exampleAiUrls) {
        List<CodeBattleExampleAI> entities = new ArrayList<>();
        int order = 1;
        for (String exampleAiUrl : exampleAiUrls) {
            entities.add(new CodeBattleExampleAI(contest, order, "", exampleAiUrl));
            order++;
        }
        exampleAIRepository.saveAll(entities);
    }

    private List<MultipartFile> filterNonEmptyFiles(List<MultipartFile> files) {
        List<MultipartFile> result = new ArrayList<>();
        if (files == null) {
            return result;
        }
        for (MultipartFile file : files) {
            if (file != null && !file.isEmpty()) {
                result.add(file);
            }
        }
        return result;
    }

    private String resolveExampleAiCodeName(int order) {
        return "example_ai_" + order;
    }

    private String extractS3Key(String keyOrUrl) {
        if (keyOrUrl == null || keyOrUrl.isBlank()) {
            return null;
        }
        if (keyOrUrl.startsWith("http")) {
            return URI.create(keyOrUrl).getPath().replaceFirst("^/", "");
        }
        return keyOrUrl;
    }

    private IllegalStateException convertUploadException(String operation, Exception e) {
        Throwable root = rootCause(e);

        if (root instanceof S3Exception s3Exception) {
            if (s3Exception.statusCode() == 403) {
                return new IllegalStateException(
                        operation + " 중 S3 인증 오류(403)가 발생했습니다. AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY 및 버킷 권한을 확인하세요.",
                        e);
            }
            return new IllegalStateException(operation + " 중 S3 오류가 발생했습니다. status=" + s3Exception.statusCode(), e);
        }

        return new IllegalStateException(operation + " 중 리소스 업로드 실패", e);
    }

    private Throwable rootCause(Throwable throwable) {
        Throwable current = throwable;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        return current;
    }

    @Transactional(readOnly = true)
    public ContestResponse getContestResponse(Long contestId) {
        CodeBattleContest contest = getContestById(contestId);
        applyResourceUrlsIfMissing(contest);
        return ContestResponse.from(contest, getExampleAiUrls(contestId));
    }

    private List<String> getExampleAiUrls(Long contestId) {
        return exampleAIRepository.findByContestIdOrderByExampleOrderAsc(contestId)
                .stream()
                .map(CodeBattleExampleAI::getCode)
                .toList();
    }

    @Transactional(readOnly = true)
    public ContestDetailResponse getContestDetailResponse(Long contestId) {
        CodeBattleContest contest = getContestById(contestId);
        applyResourceUrlsIfMissing(contest);
        return ContestDetailResponse.from(contest);
    }

    @Transactional
    public ContestDetailResponse updateContest(Long contestId, UpdateContestRequest request) {
        CodeBattleContest contest = contestRepository.findById(contestId)
                .orElseThrow(() -> new IllegalArgumentException("대회를 찾을 수 없습니다."));

        LocalDateTime now = LocalDateTime.now();
        boolean hasStatusOrSchedulePatch = request.getStatus() != null
                || request.getStartDate() != null
                || request.getEndDate() != null;

        DatePolicy policy = hasStatusOrSchedulePatch
                ? resolveDatePolicyForUpdate(contest, request, now)
                : new DatePolicy(contest.getStartDate(), contest.getEndDate());

        validatePatchValues(request);

        contest.updateContestFields(
                trimToNull(request.getTitle()),
                trimToNull(request.getDescription()),
                request.getCertification(),
                request.getTimeLimitSec(),
                request.getMemoryLimitMb(),
                null,
                null,
                request.getMaxParticipants());

        if (hasStatusOrSchedulePatch) {
            ContestStatus targetStatus = request.getStatus() != null ? request.getStatus() : contest.getStatus();
            contest.updateStatusAndSchedule(targetStatus, policy.startDate(), policy.endDate());
        }

        if (hasStatusOrSchedulePatch) {
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        if (contest.getStatus() == ContestStatus.PLANNED
                                && contest.getStartDate() != null
                                && contest.getEndDate() != null) {
                            contestRun.upsertContestSchedule(contest);
                        }
                    }
                });
            } else {
                if (contest.getStatus() == ContestStatus.PLANNED
                        && contest.getStartDate() != null
                        && contest.getEndDate() != null) {
                    contestRun.upsertContestSchedule(contest);
                }
            }
        }

        return ContestDetailResponse.from(contest);
    }

    @Transactional(readOnly = true)
    public Page<ContestListResponse> getContestPage(ContestStatus status, Pageable pageable) {
        if (status != null) {
            return contestRepository.findByStatus(status, pageable)
                    .map(ContestListResponse::from);
        }
        return contestRepository.findAll(pageable)
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
        if (status == ContestStatus.END) {
            throw new IllegalArgumentException("종료된 대회에는 참가할 수 없습니다.");
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

    private DatePolicy resolveDatePolicyForUpdate(
            CodeBattleContest contest,
            UpdateContestRequest request,
            LocalDateTime now) {

        ContestStatus target = request.getStatus() != null ? request.getStatus() : contest.getStatus();

        if (target == ContestStatus.TEST) {
            // TEST는 일정 무시
            return new DatePolicy(null, null);
        }

        LocalDateTime startDate = request.getStartDate() != null ? request.getStartDate() : contest.getStartDate();
        LocalDateTime endDate = request.getEndDate() != null ? request.getEndDate() : contest.getEndDate();

        // 상태를 RUNNING으로 바꾸면서 시작 시간이 없거나 미래면 현재 시각으로 시작
        if (target == ContestStatus.RUNNING && request.getStartDate() == null
                && (startDate == null || now.isBefore(startDate))) {
            startDate = now;
        }

        validateDatePair(startDate, endDate);

        // 날짜 수정 시점 검증은 상태별로 다르게 적용한다.
        if (request.getStartDate() != null || request.getEndDate() != null) {
            if (target == ContestStatus.RUNNING || target == ContestStatus.PAUSED) {
                if (!startDate.isBefore(now)) {
                    throw new IllegalArgumentException("RUNNING/PAUSED 상태에서는 시작 시간이 현재 시간보다 이전이어야 합니다.");
                }
                if (!endDate.isAfter(now)) {
                    throw new IllegalArgumentException("RUNNING/PAUSED 상태에서는 종료 시간이 현재 시간보다 이후여야 합니다.");
                }
            }
        }

        validateStatusByPeriod(target, startDate, endDate, now);
        return new DatePolicy(startDate, endDate);
    }

    private void validatePatchValues(UpdateContestRequest request) {
        if (request.getTimeLimitSec() != null && request.getTimeLimitSec() <= 0) {
            throw new IllegalArgumentException("시간 제한은 1 이상이어야 합니다.");
        }
        if (request.getMemoryLimitMb() != null && request.getMemoryLimitMb() <= 0) {
            throw new IllegalArgumentException("메모리 제한은 1 이상이어야 합니다.");
        }
        if (request.getMaxParticipants() != null && request.getMaxParticipants() <= 0) {
            throw new IllegalArgumentException("최대 참가자 수는 1 이상이어야 합니다.");
        }
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    // DB에 저장된 URL만 반환. 업로드 전이면 null 반환 (하드코딩 URL 반환 X)
    private void applyResourceUrlsIfMissing(CodeBattleContest contest) {
        // no-op: URL은 리소스 업로드 API에서 업로드 후에만 DB에 저장됨
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

    private record DatePolicy(LocalDateTime startDate, LocalDateTime endDate) {
    }

    public ContestSchedule saveSchedule(Long contestId, ContestScheduleRequest request) {
        CodeBattleContest contest = contestRepository.findById(contestId)
                .orElseThrow(() -> new EntityNotFoundException("대회를 찾을 수 없습니다."));

        LocalDateTime start = request.getStartDate();

        ContestSchedule schedule = new ContestSchedule();
        schedule.setContest(contest);
        schedule.setScheduledAt(start);
        ContestSchedule saved = contestScheduleRepository.save(schedule);

        return saved;

    }
}
