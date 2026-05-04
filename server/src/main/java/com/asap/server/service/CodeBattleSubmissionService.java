package com.asap.server.service;

import com.asap.server.domain.CodeBattleMatch;
import com.asap.server.domain.CodeBattleSubmission;
import com.asap.server.dto.response.CodeBattleAiMatchResult;
import com.asap.server.dto.response.CodeBattleMySubmissionResponse;
import com.asap.server.repository.CodeBattleMatchRepository;
import com.asap.server.repository.CodeBattleSubmissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CodeBattleSubmissionService {

    private final CodeBattleSubmissionRepository submissionRepository;
    private final CodeBattleMatchRepository matchRepository;

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