package com.asap.server.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleParticipant;
import com.asap.server.domain.ContestReviewer;
import com.asap.server.domain.Users;
import com.asap.server.dto.request.CreateCertifiedContestRequest;
import com.asap.server.dto.request.CreateUncertifiedContestRequest;
import com.asap.server.dto.request.ExampleAiRequest;
import com.asap.server.dto.request.SampleCodeRequest;
import com.asap.server.dto.response.ContestResponse;
import com.asap.server.global.type.ContestStatus;
import com.asap.server.global.type.Language;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.CodeBattleExampleAIRepository;
import com.asap.server.repository.CodeBattleMatchRepository;
import com.asap.server.repository.CodeBattleParticipantRepository;
import com.asap.server.repository.CodeBattleSampleCodeRepository;
import com.asap.server.repository.ContestReviewerRepository;
import com.asap.server.repository.usersRepository;

@ExtendWith(MockitoExtension.class)
@DisplayName("ContestService 단위 테스트")
class ContestServiceTest {

        @Mock
        private CodeBattleContestRepository contestRepository;
        @Mock
        private CodeBattleExampleAIRepository exampleAIRepository;
        @Mock
        private CodeBattleParticipantRepository participantRepository;
        @Mock
        private ContestReviewerRepository reviewerRepository;
        @Mock
        private usersRepository userRepository;
        @Mock
        private ContestRunService contestRun;
        @Mock
        private S3Service s3Service;
        @Mock
        private CodeBattleMatchRepository matchRepository;
        @Mock
        private CodeBattleSampleCodeRepository sampleCodeRepository;

        @InjectMocks
        private ContestService contestService;

        private Users testUser;
        private CodeBattleContest testContest;

        @BeforeEach
        void setUp() {
                testUser = Users.builder()
                                .id(1L)
                                .email("creator@test.com")
                                .password("encodedPassword")
                                .build();

                testContest = CodeBattleContest.create(
                                "Test Contest", "Description", ContestStatus.TEST,
                                false, 3, 256, "judge code", 10,
                                null, null, null, null, testUser);
        }

        // ─────────────────────────────────────────────────────────────
        // createUncertifiedContest
        // ─────────────────────────────────────────────────────────────

        @Test
        @DisplayName("비인증 대회 생성 성공 (TEST 상태 - 날짜 없음)")
        void createUncertifiedContest_success_testStatus() throws IOException {
                when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
                when(contestRepository.save(any(CodeBattleContest.class))).thenReturn(testContest);

                ContestResponse response = contestService.createUncertifiedContest(1L,
                                buildUncertifiedRequest(ContestStatus.TEST, null, null));

                assertThat(response).isNotNull();
                assertThat(response.getTitle()).isEqualTo("Test Contest");
                verify(contestRepository).save(any(CodeBattleContest.class));
                verify(contestRun).registerContest(any());
        }

        @Test
        @DisplayName("비인증 대회 생성 성공 (PLANNED 상태 - 미래 날짜)")
        void createUncertifiedContest_success_plannedStatus() throws IOException {
                LocalDateTime start = LocalDateTime.now().plusDays(1);
                LocalDateTime end = LocalDateTime.now().plusDays(2);

                CodeBattleContest planned = CodeBattleContest.create(
                                "Planned Contest", "Description", ContestStatus.PLANNED,
                                false, 3, 256, "judge code", 10, start, end, null, null, testUser);

                when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
                when(contestRepository.save(any(CodeBattleContest.class))).thenReturn(planned);

                ContestResponse response = contestService.createUncertifiedContest(1L,
                                buildUncertifiedRequest(ContestStatus.PLANNED, start, end));

                assertThat(response).isNotNull();
                assertThat(response.getStatus()).isEqualTo(ContestStatus.PLANNED);
        }

        @Test
        @DisplayName("비인증 대회 생성 - 사용자 없으면 예외")
        void createUncertifiedContest_userNotFound() {
                when(userRepository.findById(99L)).thenReturn(Optional.empty());

                assertThatThrownBy(() -> contestService.createUncertifiedContest(99L,
                                buildUncertifiedRequest(ContestStatus.TEST, null, null)))
                                .isInstanceOf(IllegalArgumentException.class)
                                .hasMessageContaining("사용자를 찾을 수 없습니다.");
        }

        @Test
        @DisplayName("비인증 대회 생성 - certification=true 이면 예외")
        void createUncertifiedContest_certificationMustBeFalse() {
                when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));

                CreateUncertifiedContestRequest request = buildUncertifiedRequest(ContestStatus.TEST, null, null);
                request.setCertification(true);

                assertThatThrownBy(() -> contestService.createUncertifiedContest(1L, request))
                                .isInstanceOf(IllegalArgumentException.class)
                                .hasMessageContaining("비인증 대회는 certification=false 여야 합니다.");
        }

        @Test
        @DisplayName("비인증 대회 생성 - 필수 코드(sampleCode/judgeCode/AI코드) 누락 시 예외")
        void createUncertifiedContest_missingRequiredCodes() {
                when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));

                CreateUncertifiedContestRequest request = buildUncertifiedRequest(ContestStatus.TEST, null, null);
                request.setSampleCodes(null);

                assertThatThrownBy(() -> contestService.createUncertifiedContest(1L, request))
                                .isInstanceOf(IllegalArgumentException.class)
                                .hasMessageContaining("sampleCode");
        }

        @Test
        @DisplayName("비인증 대회 생성 - TEST 외 상태에서 날짜 미입력 시 예외")
        void createUncertifiedContest_missingDatesForNonTestStatus() {
                when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));

                assertThatThrownBy(() -> contestService.createUncertifiedContest(1L,
                                buildUncertifiedRequest(ContestStatus.PLANNED, null, null)))
                                .isInstanceOf(IllegalArgumentException.class)
                                .hasMessageContaining("시작/종료 날짜는 필수입니다.");
        }

        @Test
        @DisplayName("비인증 대회 생성 - startDate >= endDate 이면 예외")
        void createUncertifiedContest_startNotBeforeEnd() {
                when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));

                LocalDateTime start = LocalDateTime.now().plusDays(2);
                LocalDateTime end = LocalDateTime.now().plusDays(1);

                assertThatThrownBy(() -> contestService.createUncertifiedContest(1L,
                                buildUncertifiedRequest(ContestStatus.PLANNED, start, end)))
                                .isInstanceOf(IllegalArgumentException.class)
                                .hasMessageContaining("startDate는 endDate보다 이전이어야 합니다.");
        }

        @Test
        @DisplayName("비인증 대회 생성 - PLANNED 상태인데 startDate 가 과거이면 예외")
        void createUncertifiedContest_plannedButStartInPast() {
                when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));

                LocalDateTime start = LocalDateTime.now().minusDays(2);
                LocalDateTime end = LocalDateTime.now().plusDays(1);

                assertThatThrownBy(() -> contestService.createUncertifiedContest(1L,
                                buildUncertifiedRequest(ContestStatus.PLANNED, start, end)))
                                .isInstanceOf(IllegalArgumentException.class)
                                .hasMessageContaining("PLANNED는 대회 시작 전일 때만 가능합니다.");
        }

        // ─────────────────────────────────────────────────────────────
        // createCertifiedContest
        // ─────────────────────────────────────────────────────────────

        @Test
        @DisplayName("인증 대회 생성 성공 (TEST 상태)")
        void createCertifiedContest_success_testStatus() throws IOException {
                CodeBattleContest certified = CodeBattleContest.create(
                                "Certified Contest", "Description", ContestStatus.TEST,
                                true, 3, 256, "judge code", 10, null, null,
                                "<html>viz</html>", "<html>solo</html>", testUser);

                when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
                when(contestRepository.save(any(CodeBattleContest.class))).thenReturn(certified);

                ContestResponse response = contestService.createCertifiedContest(1L,
                                buildCertifiedRequest(ContestStatus.TEST, null, null));

                assertThat(response).isNotNull();
                assertThat(response.getCertification()).isTrue();
                verify(reviewerRepository).save(any(ContestReviewer.class));
        }

        @Test
        @DisplayName("인증 대회 생성 - certification=false 이면 예외")
        void createCertifiedContest_certificationMustBeTrue() {
                when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));

                CreateCertifiedContestRequest request = buildCertifiedRequest(ContestStatus.TEST, null, null);
                request.setCertification(false);

                assertThatThrownBy(() -> contestService.createCertifiedContest(1L, request))
                                .isInstanceOf(IllegalArgumentException.class)
                                .hasMessageContaining("인증 대회는 certification=true 여야 합니다.");
        }

        @Test
        @DisplayName("인증 대회 생성 - visualizationHtml 누락 시 예외")
        void createCertifiedContest_missingVisualizationHtml() {
                when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));

                CreateCertifiedContestRequest request = buildCertifiedRequest(ContestStatus.TEST, null, null);
                request.setVisualizationHtml(null);

                assertThatThrownBy(() -> contestService.createCertifiedContest(1L, request))
                                .isInstanceOf(IllegalArgumentException.class)
                                .hasMessageContaining("visualizationHtml");
        }

        @Test
        @DisplayName("인증 대회 생성 - exampleAiCodes 누락 시 예외")
        void createCertifiedContest_missingExampleAiCodes() {
                when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));

                CreateCertifiedContestRequest request = buildCertifiedRequest(ContestStatus.TEST, null, null);
                request.setExampleAiCodes(null);

                assertThatThrownBy(() -> contestService.createCertifiedContest(1L, request))
                                .isInstanceOf(IllegalArgumentException.class)
                                .hasMessageContaining("sampleCode");
        }

        // ─────────────────────────────────────────────────────────────
        // joinContest
        // ─────────────────────────────────────────────────────────────

        @Test
        @DisplayName("대회 참가 신청 성공")
        void joinContest_success() {
                when(contestRepository.findById(1L)).thenReturn(Optional.of(testContest));
                when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.of(testUser));
                when(participantRepository.existsByUserIdAndContestId(1L, 1L)).thenReturn(false);
                when(participantRepository.countByContestId(1L)).thenReturn(5L);

                contestService.joinContest(1L, "test@test.com");

                verify(participantRepository).save(any(CodeBattleParticipant.class));
        }

        @Test
        @DisplayName("대회 참가 - 대회 없음 예외")
        void joinContest_contestNotFound() {
                when(contestRepository.findById(99L)).thenReturn(Optional.empty());

                assertThatThrownBy(() -> contestService.joinContest(99L, "test@test.com"))
                                .isInstanceOf(IllegalArgumentException.class)
                                .hasMessageContaining("해당 ID의 대회를 찾을 수 없습니다");
        }

        @Test
        @DisplayName("대회 참가 - 이미 참가 중이면 예외")
        void joinContest_alreadyJoined() {
                when(contestRepository.findById(1L)).thenReturn(Optional.of(testContest));
                when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.of(testUser));
                when(participantRepository.existsByUserIdAndContestId(any(), any())).thenReturn(true);

                assertThatThrownBy(() -> contestService.joinContest(1L, "test@test.com"))
                                .isInstanceOf(IllegalArgumentException.class)
                                .hasMessageContaining("이미 참가 신청한 대회입니다.");
        }

        @Test
        @DisplayName("대회 참가 - 최대 참가자 초과 예외")
        void joinContest_maxParticipantsExceeded() {
                when(contestRepository.findById(1L)).thenReturn(Optional.of(testContest)); // maxParticipants = 10
                when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.of(testUser));
                when(participantRepository.existsByUserIdAndContestId(any(), any())).thenReturn(false);
                when(participantRepository.countByContestId(any())).thenReturn(10L);

                assertThatThrownBy(() -> contestService.joinContest(1L, "test@test.com"))
                                .isInstanceOf(IllegalArgumentException.class)
                                .hasMessageContaining("최대 참가자 수를 초과했습니다.");
        }

        @Test
        @DisplayName("종료된 대회에 참가 불가")
        void joinContest_endedContest() {
                CodeBattleContest ended = CodeBattleContest.create(
                                "Ended", "Desc", ContestStatus.END, false, 3, 256, "j", 10,
                                null, null, null, null, testUser);
                when(contestRepository.findById(1L)).thenReturn(Optional.of(ended));

                assertThatThrownBy(() -> contestService.joinContest(1L, "test@test.com"))
                                .isInstanceOf(IllegalArgumentException.class)
                                .hasMessageContaining("종료되거나 취소된 대회에는 참가할 수 없습니다.");
        }

        @Test
        @DisplayName("취소된 대회에 참가 불가")
        void joinContest_canceledContest() {
                CodeBattleContest canceled = CodeBattleContest.create(
                                "Canceled", "Desc", ContestStatus.CANCELED, false, 3, 256, "j", 10,
                                null, null, null, null, testUser);
                when(contestRepository.findById(1L)).thenReturn(Optional.of(canceled));

                assertThatThrownBy(() -> contestService.joinContest(1L, "test@test.com"))
                                .isInstanceOf(IllegalArgumentException.class)
                                .hasMessageContaining("종료되거나 취소된 대회에는 참가할 수 없습니다.");
        }

        // ─────────────────────────────────────────────────────────────
        // cancelJoinContest
        // ─────────────────────────────────────────────────────────────

        @Test
        @DisplayName("대회 참가 취소 성공")
        void cancelJoinContest_success() {
                CodeBattleParticipant participant = new CodeBattleParticipant(testUser, testContest, 0, null);
                when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.of(testUser));
                when(participantRepository.findByUserIdAndContestId(any(), any())).thenReturn(Optional.of(participant));

                contestService.cancelJoinContest(1L, "test@test.com");

                verify(participantRepository).delete(participant);
        }

        @Test
        @DisplayName("대회 참가 취소 - 사용자 없음 예외")
        void cancelJoinContest_userNotFound() {
                when(userRepository.findByEmail("notfound@test.com")).thenReturn(Optional.empty());

                assertThatThrownBy(() -> contestService.cancelJoinContest(1L, "notfound@test.com"))
                                .isInstanceOf(IllegalArgumentException.class)
                                .hasMessageContaining("사용자를 찾을 수 없습니다.");
        }

        @Test
        @DisplayName("대회 참가 취소 - 참가 이력 없음 예외")
        void cancelJoinContest_noParticipation() {
                when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.of(testUser));
                when(participantRepository.findByUserIdAndContestId(any(), any())).thenReturn(Optional.empty());

                assertThatThrownBy(() -> contestService.cancelJoinContest(1L, "test@test.com"))
                                .isInstanceOf(IllegalArgumentException.class)
                                .hasMessageContaining("참가 신청 내역이 없습니다.");
        }

        // ─────────────────────────────────────────────────────────────
        // getContestById
        // ─────────────────────────────────────────────────────────────

        @Test
        @DisplayName("대회 조회 - 없는 대회 예외")
        void getContestById_notFound() {
                when(contestRepository.findById(99L)).thenReturn(Optional.empty());

                assertThatThrownBy(() -> contestService.getContestById(99L))
                                .isInstanceOf(IllegalArgumentException.class)
                                .hasMessageContaining("해당 ID의 대회를 찾을 수 없습니다");
        }

        // ─────────────────────────────────────────────────────────────
        // Helper
        // ─────────────────────────────────────────────────────────────

        private CreateUncertifiedContestRequest buildUncertifiedRequest(
                        ContestStatus status, LocalDateTime start, LocalDateTime end) {

                ExampleAiRequest ai = new ExampleAiRequest();
                ai.setCode("int main() { return 0; }");
                ai.setDescription("test AI");

                SampleCodeRequest sample = new SampleCodeRequest();
                sample.setCode("int main() { return 0; }");
                sample.setLanguage(Language.CPP);

                CreateUncertifiedContestRequest req = new CreateUncertifiedContestRequest();
                req.setCreatorId(1L);
                req.setCertification(false);
                req.setTitle("Test Contest");
                req.setDescription("Description");
                req.setTimeLimitSec(3);
                req.setMemoryLimitMb(256);
                req.setMaxParticipants(10);
                req.setStatus(status);
                req.setStartDate(start);
                req.setEndDate(end);
                req.setJudgeCode("int main() { return 0; }");
                req.setSampleCodes(List.of(sample));
                req.setExampleAiCodes(List.of(ai));
                return req;
        }

        private CreateCertifiedContestRequest buildCertifiedRequest(
                        ContestStatus status, LocalDateTime start, LocalDateTime end) {

                ExampleAiRequest ai = new ExampleAiRequest();
                ai.setCode("int main() { return 0; }");
                ai.setDescription("test AI");

                SampleCodeRequest sample = new SampleCodeRequest();
                sample.setCode("int main() { return 0; }");
                sample.setLanguage(Language.CPP);

                CreateCertifiedContestRequest req = new CreateCertifiedContestRequest();
                req.setCreatorId(1L);
                req.setCertification(true);
                req.setTitle("Certified Contest");
                req.setDescription("Description");
                req.setTimeLimitSec(3);
                req.setMemoryLimitMb(256);
                req.setMaxParticipants(10);
                req.setStatus(status);
                req.setStartDate(start);
                req.setEndDate(end);
                req.setJudgeCode("int main() { return 0; }");
                req.setSampleCodes(List.of(sample));
                req.setExampleAiCodes(List.of(ai));
                req.setReviewerEmails(List.of("reviewer@test.com"));
                req.setVisualizationHtml("<html>viz</html>");
                req.setSoloPlayHtml("<html>solo</html>");
                return req;
        }
}
