package com.asap.server.service;

import com.asap.server.domain.CodeBattleMatch;
import com.asap.server.domain.CodeBattleSubmission;
import com.asap.server.dto.response.CodeBattleAiMatchResult;
import com.asap.server.dto.response.CodeBattleMatchResult;
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

        // 해당 유저가 AI와 진행한 모든 매치 기록 조회
        List<CodeBattleMatch> matches = matchRepository.findByContestIdAndUser1IdAndUser2Id(contestId, userId, 1L);
        System.out.println("조회 시도 - contestId: " + contestId + ", userId: " + userId);

        return matches.stream()
                .map(match -> {
                    CodeBattleAiMatchResult aiResult = CodeBattleAiMatchResult.from(match, userId);

                    return CodeBattleMySubmissionResponse.of(match.getSubmission(), aiResult);
                })
                .collect(Collectors.toList());
    }
}