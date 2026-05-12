package com.asap.server.service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleMatch;
import com.asap.server.domain.CodeBattleSubmission;
import com.asap.server.domain.Users;
import com.asap.server.dto.response.CodeBattleAiMatchResult;
import com.asap.server.dto.response.CodeBattleMySubmissionResponse;
import com.asap.server.global.type.Language;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.CodeBattleMatchRepository;
import com.asap.server.repository.CodeBattleSubmissionRepository;
import com.asap.server.repository.usersRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CodeBattleSubmissionService {

    private final CodeBattleSubmissionRepository submissionRepository;
    private final CodeBattleMatchRepository matchRepository;
    private final CodeBattleContestRepository contestRepository;
    private final usersRepository userRepository;

    @Transactional
    public CodeBattleSubmission submitAndQueuePullLeague(
            Long contestId, Long userId, Language language, String sourceCode) {
        CodeBattleContest contest = contestRepository.findById(contestId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 대회입니다."));
        Users user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 유저입니다."));
        CodeBattleSubmission submission = new CodeBattleSubmission(user, contest, language, sourceCode, "PENDING");
        return submissionRepository.save(submission);
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