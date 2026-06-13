package com.asap.server.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import com.asap.server.domain.Users;
import com.asap.server.dto.request.TestSubmitRequest;
import com.asap.server.dto.response.ContestParticipantResponse;
import com.asap.server.global.type.Language;
import com.asap.server.repository.usersRepository;
import com.asap.server.service.ContestService;

@ExtendWith(MockitoExtension.class)
@DisplayName("ParticipantController 단위 테스트")
class ParticipantControllerTest {

    @Mock private ContestService contestService;
    @Mock private usersRepository userRepository;
    @Mock private CodeController codeController;

    @InjectMocks
    private ParticipantController participantController;

    @Test
    @DisplayName("대회 참가 신청 성공")
    void joinContest_success() {
        doNothing().when(contestService).joinContest(anyLong(), anyString());

        ResponseEntity<String> result = participantController.joinContest(1L, "test@test.com");

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(result.getBody()).contains("참가 신청이 완료되었습니다");
        verify(contestService).joinContest(1L, "test@test.com");
    }

    @Test
    @DisplayName("대회 참가 취소 성공")
    void cancelJoinContest_success() {
        doNothing().when(contestService).cancelJoinContest(anyLong(), anyString());

        ResponseEntity<String> result = participantController.cancelJoinContest(1L, "test@test.com");

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(result.getBody()).contains("참가 취소가 완료되었습니다");
    }

    @Test
    @DisplayName("대회 참가자 목록 조회 성공")
    void getContestParticipants_success() {
        Page<ContestParticipantResponse> emptyPage = new PageImpl<>(List.of());
        when(contestService.getContestParticipants(anyLong(), any(Pageable.class))).thenReturn(emptyPage);

        ResponseEntity<Page<ContestParticipantResponse>> result =
                participantController.getContestParticipants(1L, Pageable.unpaged());

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("테스트 참가자 다수 신청 성공")
    void multipleJoinContest_success() {
        doNothing().when(contestService).joinContest(anyLong(), anyString());

        ResponseEntity<String> result = participantController.multipleJoinContest(1L, 3);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("테스트 참가자 다수 신청 - 범위 초과 → 400")
    void multipleJoinContest_outOfRange() {
        ResponseEntity<String> result = participantController.multipleJoinContest(1L, 51);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @DisplayName("테스트 참가자 다수 신청 - 0 → 400")
    void multipleJoinContest_zero() {
        ResponseEntity<String> result = participantController.multipleJoinContest(1L, 0);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @DisplayName("테스트 코드 자동 제출 - 범위 오류 → 400")
    void multipleSubmitContest_invalidRange() {
        TestSubmitRequest req = new TestSubmitRequest();
        req.setFrom(5);
        req.setTo(3);
        req.setLanguage(Language.CPP);
        req.setSourceCode("int main(){}");

        ResponseEntity<String> result = participantController.multipleSubmitContest(1L, req);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @DisplayName("테스트 코드 자동 제출 - 유저 없으면 건너뜀")
    void multipleSubmitContest_userNotFound_skip() {
        TestSubmitRequest req = new TestSubmitRequest();
        req.setFrom(1);
        req.setTo(2);
        req.setLanguage(Language.CPP);
        req.setSourceCode("int main(){}");

        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());

        ResponseEntity<String> result = participantController.multipleSubmitContest(1L, req);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("테스트 코드 자동 제출 - 유저 있으면 제출")
    void multipleSubmitContest_withUser() {
        Users testUser = Users.builder().id(1L).email("test_01@test.com").password("pw").build();

        TestSubmitRequest req = new TestSubmitRequest();
        req.setFrom(1);
        req.setTo(1);
        req.setLanguage(Language.CPP);
        req.setSourceCode("int main(){}");

        when(userRepository.findByEmail("test_01@test.com")).thenReturn(Optional.of(testUser));
        when(codeController.submitBattle(any())).thenReturn(mock(ResponseEntity.class));

        ResponseEntity<String> result = participantController.multipleSubmitContest(1L, req);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
