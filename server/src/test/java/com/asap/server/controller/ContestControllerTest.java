package com.asap.server.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.Users;
import com.asap.server.dto.request.CreateCertifiedContestRequest;
import com.asap.server.dto.request.CreateUncertifiedContestRequest;
import com.asap.server.dto.request.UpdateContestCertifiedRequest;
import com.asap.server.dto.request.UpdateContestRequest;
import com.asap.server.dto.request.ValidateContestRequest;
import com.asap.server.dto.response.CodeBattleMySubmissionResponse;
import com.asap.server.dto.response.ContestDetailResponse;
import com.asap.server.dto.response.ContestListResponse;
import com.asap.server.dto.response.ContestResponse;
import com.asap.server.global.type.ContestStatus;
import com.asap.server.global.type.Language;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.CodeBattleMatchRepository;
import com.asap.server.repository.ContestSwissMatchRepository;
import com.asap.server.repository.ContestSwissSessionRepository;
import com.asap.server.repository.ProfileRepository;
import com.asap.server.service.ContestRunService;
import com.asap.server.service.ContestService;
import com.asap.server.service.FullLeagueService;
import com.asap.server.service.S3Service;
import com.asap.server.service.SseService;
import com.asap.server.service.SwissLeagueService;
import com.fasterxml.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
@DisplayName("ContestController 단위 테스트")
class ContestControllerTest {

    @Mock private ContestService contestService;
    @Mock private ContestRunService contestRunService;
    @Mock private S3Service s3Service;
    @Spy  private ObjectMapper objectMapper = new ObjectMapper();
    @Mock private CodeBattleContestRepository contestRepository;
    @Mock private FullLeagueService fullLeagueService;
    @Mock private SwissLeagueService swissService;
    @Mock private ContestSwissSessionRepository sessionRepository;
    @Mock private SseService sseService;
    @Mock private ContestSwissMatchRepository swissMatchRepository;
    @Mock private CodeBattleMatchRepository matchRepository;
    @Mock private ProfileRepository profileRepository;

    @InjectMocks
    private ContestController contestController;

    private Users creatorUser;
    private CodeBattleContest testContest;

    @BeforeEach
    void setUp() {
        creatorUser = Users.builder().id(1L).email("creator@test.com").password("pw").build();
        testContest = CodeBattleContest.create(
                "Test", "Desc", ContestStatus.TEST, false, 3, 256, "judge", Language.CPP,
                10, null, null, null, null, creatorUser);
    }

    // ─────────────────────────────────────────────────────────────
    // createContest (비인증)
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("비인증 대회 생성 성공")
    void createContest_success() throws Exception {
        ContestResponse mockResponse = mock(ContestResponse.class);
        when(mockResponse.getId()).thenReturn(1L);
        when(contestService.createUncertifiedContest(any(), any())).thenReturn(mockResponse);

        CreateUncertifiedContestRequest req = new CreateUncertifiedContestRequest();
        req.setCreatorId(1L);

        ResponseEntity<?> result = contestController.createContest(req);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    @Test
    @DisplayName("비인증 대회 생성 - IllegalArgumentException → 400")
    void createContest_illegalArgument() throws Exception {
        when(contestService.createUncertifiedContest(any(), any()))
                .thenThrow(new IllegalArgumentException("잘못된 요청"));

        CreateUncertifiedContestRequest req = new CreateUncertifiedContestRequest();
        req.setCreatorId(1L);

        ResponseEntity<?> result = contestController.createContest(req);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @DisplayName("비인증 대회 생성 - IllegalStateException → 500")
    void createContest_illegalState() throws Exception {
        when(contestService.createUncertifiedContest(any(), any()))
                .thenThrow(new IllegalStateException("서버 오류"));

        CreateUncertifiedContestRequest req = new CreateUncertifiedContestRequest();
        req.setCreatorId(1L);

        ResponseEntity<?> result = contestController.createContest(req);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // ─────────────────────────────────────────────────────────────
    // createCertifiedContest (인증)
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("인증 대회 생성 성공")
    void createCertifiedContest_success() throws Exception {
        ContestResponse mockResponse = mock(ContestResponse.class);
        when(mockResponse.getId()).thenReturn(2L);
        when(contestService.createCertifiedContest(any(), any())).thenReturn(mockResponse);

        CreateCertifiedContestRequest req = new CreateCertifiedContestRequest();
        req.setCreatorId(1L);

        ResponseEntity<?> result = contestController.createCertifiedContest(req);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    @Test
    @DisplayName("인증 대회 생성 - IllegalArgumentException → 400")
    void createCertifiedContest_illegalArgument() throws Exception {
        when(contestService.createCertifiedContest(any(), any()))
                .thenThrow(new IllegalArgumentException("잘못된 요청"));

        CreateCertifiedContestRequest req = new CreateCertifiedContestRequest();
        req.setCreatorId(1L);

        ResponseEntity<?> result = contestController.createCertifiedContest(req);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    // ─────────────────────────────────────────────────────────────
    // getContestList
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("대회 목록 조회 성공")
    void getContestList_success() {
        Page<ContestListResponse> emptyPage = new PageImpl<>(List.of());
        when(contestService.getContestPage(any(), any(Pageable.class))).thenReturn(emptyPage);

        ResponseEntity<Page<ContestListResponse>> result =
                contestController.getContestList(null, Pageable.unpaged());

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    // ─────────────────────────────────────────────────────────────
    // getContestDetail
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("대회 상세 조회 성공")
    void getContestDetail_success() {
        ContestResponse mockResponse = mock(ContestResponse.class);
        when(contestService.getContestResponse(1L)).thenReturn(mockResponse);

        ResponseEntity<ContestResponse> result = contestController.getContestDetail(1L);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    // ─────────────────────────────────────────────────────────────
    // getContestDetailAdmin
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("대회 상세(어드민) 조회 성공")
    void getContestDetailAdmin_success() {
        ContestDetailResponse mockDetail = mock(ContestDetailResponse.class);
        when(contestRepository.findById(1L)).thenReturn(Optional.of(testContest));
        when(contestService.getContestDetailResponse(1L)).thenReturn(mockDetail);

        ResponseEntity<ContestDetailResponse> result = contestController.getContestDetailAdmin(1L, 1L);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("대회 상세(어드민) - 권한 없는 사용자 → 403")
    void getContestDetailAdmin_forbidden() {
        when(contestRepository.findById(1L)).thenReturn(Optional.of(testContest));

        ResponseEntity<ContestDetailResponse> result = contestController.getContestDetailAdmin(99L, 1L);

        assertThat(result.getStatusCode().value()).isEqualTo(403);
    }

    // ─────────────────────────────────────────────────────────────
    // updateContestCertified
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("인증 대회 수정 성공")
    void updateContestCertified_success() {
        ContestDetailResponse mockDetail = mock(ContestDetailResponse.class);
        when(contestRepository.findById(1L)).thenReturn(Optional.of(testContest));
        when(contestService.updateContest(any(Long.class), any(UpdateContestCertifiedRequest.class)))
                .thenReturn(mockDetail);

        ResponseEntity<ContestDetailResponse> result =
                contestController.updateContestCertified(1L, 1L, new UpdateContestCertifiedRequest());

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("인증 대회 수정 - 권한 없는 사용자 → 403")
    void updateContestCertified_forbidden() {
        when(contestRepository.findById(1L)).thenReturn(Optional.of(testContest));

        ResponseEntity<ContestDetailResponse> result =
                contestController.updateContestCertified(99L, 1L, new UpdateContestCertifiedRequest());

        assertThat(result.getStatusCode().value()).isEqualTo(403);
    }

    @Test
    @DisplayName("인증 대회 수정 - 대회 없음 → 400")
    void updateContestCertified_notFound() {
        when(contestRepository.findById(99L)).thenReturn(Optional.empty());

        ResponseEntity<ContestDetailResponse> result =
                contestController.updateContestCertified(1L, 99L, new UpdateContestCertifiedRequest());

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    // ─────────────────────────────────────────────────────────────
    // updateContestUncertified
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("비인증 대회 수정 성공")
    void updateContestUncertified_success() {
        ContestDetailResponse mockDetail = mock(ContestDetailResponse.class);
        when(contestRepository.findById(1L)).thenReturn(Optional.of(testContest));
        when(contestService.updateContest(any(Long.class), any(UpdateContestRequest.class)))
                .thenReturn(mockDetail);

        ResponseEntity<ContestDetailResponse> result =
                contestController.updateContestUncertified(1L, 1L, new UpdateContestRequest());

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("비인증 대회 수정 - 권한 없음 → 403")
    void updateContestUncertified_forbidden() {
        when(contestRepository.findById(1L)).thenReturn(Optional.of(testContest));

        ResponseEntity<ContestDetailResponse> result =
                contestController.updateContestUncertified(99L, 1L, new UpdateContestRequest());

        assertThat(result.getStatusCode().value()).isEqualTo(403);
    }

    // ─────────────────────────────────────────────────────────────
    // getMySubmissions
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("내 제출 조회 성공")
    void getMySubmissions_success() {
        when(contestService.getMySubmissionsWithAi(1L, 1L)).thenReturn(List.of());

        ResponseEntity<List<CodeBattleMySubmissionResponse>> result =
                contestController.getMySubmissions(1L, 1L, 1L);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("내 제출 조회 - 다른 사용자 → 예외")
    void getMySubmissions_wrongUser() {
        assertThatThrownBy(() -> contestController.getMySubmissions(1L, 2L, 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("본인의 제출 이력만 조회할 수 있습니다.");
    }

    // ─────────────────────────────────────────────────────────────
    // deleteContest
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("대회 삭제 성공 - 관리자(userId=1)")
    void deleteContest_adminSuccess() {
        when(contestRepository.findById(1L)).thenReturn(Optional.of(testContest));
        doNothing().when(contestService).deleteContest(testContest);

        ResponseEntity<?> result = contestController.deleteContest(1L, 1L);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(contestService).deleteContest(testContest);
    }

    @Test
    @DisplayName("대회 삭제 성공 - 개최자")
    void deleteContest_creatorSuccess() {
        when(contestRepository.findById(1L)).thenReturn(Optional.of(testContest));
        doNothing().when(contestService).deleteContest(testContest);

        ResponseEntity<?> result = contestController.deleteContest(1L, 1L);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    @DisplayName("대회 삭제 - 대회 없음 → 400")
    void deleteContest_contestNotFound() {
        when(contestRepository.findById(99L)).thenReturn(Optional.empty());

        ResponseEntity<?> result = contestController.deleteContest(99L, 1L);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @DisplayName("대회 삭제 - 권한 없음 → 403")
    void deleteContest_forbidden() {
        when(contestRepository.findById(1L)).thenReturn(Optional.of(testContest));

        ResponseEntity<?> result = contestController.deleteContest(1L, 99L);

        assertThat(result.getStatusCode().value()).isEqualTo(403);
    }

    // ─────────────────────────────────────────────────────────────
    // validateContestCodes
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("대회 코드 검증 요청 성공")
    void validateContestCodes_success() {
        doNothing().when(contestService).validateContestCodes(any(), any());

        ResponseEntity<?> result = contestController.validateContestCodes(1L, mock(ValidateContestRequest.class));

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
    }

    @Test
    @DisplayName("대회 코드 검증 - 중복 요청 → 409")
    void validateContestCodes_conflict() {
        doThrow(new IllegalStateException("이미 진행 중")).when(contestService).validateContestCodes(any(), any());

        ResponseEntity<?> result = contestController.validateContestCodes(1L, mock(ValidateContestRequest.class));

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    @DisplayName("대회 코드 검증 - 잘못된 요청 → 400")
    void validateContestCodes_illegalArgument() {
        doThrow(new IllegalArgumentException("잘못된 요청")).when(contestService).validateContestCodes(any(), any());

        ResponseEntity<?> result = contestController.validateContestCodes(1L, mock(ValidateContestRequest.class));

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
