package com.asap.server.service;

import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleMatch;
import com.asap.server.domain.CodeBattleSubmission;
import com.asap.server.domain.ContestFinalSubmission;
import com.asap.server.domain.Users;
import com.asap.server.dto.response.CodeBattleAiMatchResult;
import com.asap.server.dto.response.CodeBattleMySubmissionResponse;
import com.asap.server.global.type.Language;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.CodeBattleMatchRepository;
import com.asap.server.repository.CodeBattleSubmissionRepository;
import com.asap.server.repository.FinalSubmissionRepository;
import com.asap.server.repository.usersRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CodeBattleSubmissionService {

    private final CodeBattleSubmissionRepository submissionRepository;
    private final CodeBattleMatchRepository matchRepository;
    private final CodeBattleContestRepository contestRepository;
    private final usersRepository userRepository;
    private final FinalSubmissionRepository finalSubmissionRepository;
    private final S3Service s3Service;

    @Transactional
    public CodeBattleSubmission submitAndQueuePullLeague(
            Long contestId, Long userId, Language language, MultipartFile sourceFile) throws IOException {
        CodeBattleContest contest = contestRepository.findById(contestId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 대회입니다."));
        Users user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 유저입니다."));

        CodeBattleSubmission submission = new CodeBattleSubmission(user, contest, language, null, "PENDING");
        submissionRepository.save(submission);

        String uploadedKey = null;
        try {
            S3Service.SubmissionUploadResult uploadResult = s3Service.uploadContestSubmissionFile(
                    contestId,
                    submission.getId(),
                    userId,
                    language,
                    sourceFile);
            uploadedKey = uploadResult.key();

            submission.changeCodeUrl(uploadResult.url());
            submission = submissionRepository.save(submission);

            saveFinalSubmit(submission);
            return submission;
        } catch (Exception e) {
            if (uploadedKey != null) {
                try {
                    s3Service.deleteObjectByKey(uploadedKey);
                } catch (Exception deleteError) {
                    // 보상 삭제 실패는 원인 예외를 가리지 않도록 로그만 남김
                }
            }
            throw e;
        }
    }

    @Transactional
    public CodeBattleSubmission submitAndQueuePullLeague(
            Long contestId, Long userId, Language language, String sourceCode) {
        CodeBattleContest contest = contestRepository.findById(contestId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 대회입니다."));
        Users user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 유저입니다."));

        if (sourceCode == null || sourceCode.isBlank()) {
            throw new IllegalArgumentException("sourceCode는 비어 있을 수 없습니다.");
        }

        CodeBattleSubmission submission = new CodeBattleSubmission(user, contest, language, null, "PENDING");
        submissionRepository.save(submission);

        String uploadedKey = null;
        try {
            S3Service.SubmissionUploadResult uploadResult = s3Service.uploadContestSubmissionContent(
                    contestId,
                    submission.getId(),
                    userId,
                    language,
                    sourceCode);
            uploadedKey = uploadResult.key();

            submission.changeCodeUrl(uploadResult.url());
            submission = submissionRepository.saveAndFlush(submission);

            saveFinalSubmit(submission);
            return submission;
        } catch (Exception e) {
            if (uploadedKey != null) {
                try {
                    s3Service.deleteObjectByKey(uploadedKey);
                } catch (Exception deleteError) {
                    // 보상 삭제 실패는 원인 예외를 가리지 않도록 로그만 남김
                }
            }
            throw e;
        }
    }

    private void saveFinalSubmit(CodeBattleSubmission submission) {

        Long userId = submission.getUser().getId();
        Long contestId = submission.getContest().getId();

        ContestFinalSubmission finalSubmission = finalSubmissionRepository
                .findByUserIdAndContestId(userId, contestId)
                .orElse(null);

        // 최초 생성
        if (finalSubmission == null) {

            finalSubmission = new ContestFinalSubmission(
                    submission.getUser(),
                    submission.getContest(),
                    submission,
                    false // AUTO 모드
            );

            finalSubmissionRepository.save(finalSubmission);
            return;
        }

        // AUTO 모드면 최신 제출로 갱신
        if (!finalSubmission.isManual()) {
            finalSubmission.changeSubmission(submission);
        }
    }

    @Transactional(readOnly = true)
    public List<CodeBattleMySubmissionResponse> getMySubmissionsWithAi(Long contestId, Long userId) {
        // 해당 대회에서 내가 제출한 목록 조회
        List<CodeBattleSubmission> submissions = submissionRepository.findByContestIdAndUserId(contestId, userId);

        return submissions.stream().map(sub -> {
            // 제출물 ID와 AI ID(1L)로 매치 결과 조회
            CodeBattleMatch aiMatch = matchRepository.findByIdAndUser2Id(sub.getId(), 1L);

            // 정적 팩토리 메서드를 사용하여 변환
            CodeBattleAiMatchResult aiResult = CodeBattleAiMatchResult.from(aiMatch, userId);
            return CodeBattleMySubmissionResponse.of(sub, aiResult);
        }).collect(Collectors.toList());
    }
}