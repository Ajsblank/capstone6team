package com.asap.server.service;

import java.time.LocalDateTime;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleContest.ContestStatus;
import com.asap.server.domain.CodeBattleParticipant;
import com.asap.server.domain.Users;
import com.asap.server.dto.request.CreateContestRequest;
import com.asap.server.dto.request.UpdateContestRequest;
import com.asap.server.dto.response.ContestDetailResponse;
import com.asap.server.dto.response.ContestListResponse;
import com.asap.server.dto.response.ContestParticipantResponse;
import com.asap.server.dto.response.ContestResponse;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.CodeBattleParticipantRepository;
import com.asap.server.repository.usersRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ContestService {

    private final CodeBattleContestRepository contestRepository;
    private final CodeBattleParticipantRepository participantRepository;
    private final usersRepository userRepository;

    @Transactional
    public ContestResponse createContest(CreateContestRequest request) {
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
                request.getJudgeCode(),
                request.getExampleCode(),
                request.getMaxParticipants(),
                policy.startDate(),
                policy.endDate());

        return ContestResponse.from(contestRepository.save(contest));
    }

    @Transactional
    public ContestDetailResponse updateContest(Long contestId, UpdateContestRequest request) {
        CodeBattleContest contest = contestRepository.findById(contestId)
                .orElseThrow(() -> new IllegalArgumentException("대회를 찾을 수 없습니다."));

        LocalDateTime now = LocalDateTime.now();
        DatePolicy policy = resolveDatePolicyForUpdate(contest, request, now);

        validatePatchValues(request);

        contest.updateContestFields(
                trimToNull(request.getTitle()),
                trimToNull(request.getDescription()),
                request.getCertification(),
                request.getTimeLimitSec(),
                request.getMemoryLimitMb(),
                trimToNull(request.getJudgeCode()),
                trimToNull(request.getExampleCode()),
                request.getMaxParticipants());

        ContestStatus targetStatus = request.getStatus() != null ? request.getStatus() : contest.getStatus();
        contest.updateStatusAndSchedule(targetStatus, policy.startDate(), policy.endDate());

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
        CodeBattleContest contest = contestRepository.findByIdWithLock(contestId)
                .orElseThrow(() -> new IllegalArgumentException("해당 ID의 대회를 찾을 수 없습니다: " + contestId));
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
            case TEST -> {
                // handled before
            }
        }
    }

    private record DatePolicy(LocalDateTime startDate, LocalDateTime endDate) {
    }
}
