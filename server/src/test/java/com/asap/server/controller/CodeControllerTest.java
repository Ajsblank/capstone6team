package com.asap.server.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Answers;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import com.asap.server.domain.CodeBattleContest;
import com.asap.server.domain.CodeBattleExampleAI;
import com.asap.server.domain.Users;
import com.asap.server.dto.request.CodeSubmitRequest;
import com.asap.server.dto.response.CodeSubmitResponse;
import com.asap.server.global.type.ContestStatus;
import com.asap.server.global.type.Language;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.CodeBattleExampleAIRepository;
import com.asap.server.repository.CodeBattleMatchRepository;
import com.asap.server.repository.CodeBattleParticipantRepository;
import com.asap.server.repository.CodeBattleSubmissionRepository;
import com.asap.server.repository.usersRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
@DisplayName("CodeController 코드 제출 단위 테스트")
class CodeControllerTest {

    @Mock(answer = Answers.RETURNS_DEEP_STUBS)
    private RedisTemplate<String, String> redisTemplate;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @Mock private usersRepository userRepository;
    @Mock private CodeBattleExampleAIRepository exampleAIRepository;
    @Mock private CodeBattleMatchRepository matchRepository;
    @Mock private CodeBattleContestRepository contestRepository;
    @Mock private CodeBattleSubmissionRepository submissionRepository;
    @Mock private CodeBattleParticipantRepository participantRepository;

    @InjectMocks
    private CodeController codeController;

    private Users testUser;
    private CodeBattleContest testContest;

    @BeforeEach
    void setUp() {
        testUser = Users.builder()
                .id(2L)
                .email("user@test.com")
                .password("encodedPassword")
                .build();

        testContest = CodeBattleContest.create(
                "Test Contest", "Description", ContestStatus.TEST,
                false, 3, 256, "int main(){return 0;}", 10,
                null, null, null, null, testUser);
    }

    // ─────────────────────────────────────────────────────────────
    // submitBattle
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("코드 제출 성공 - 채점 큐에 등록")
    void submitBattle_success() {
        CodeBattleExampleAI ai = new CodeBattleExampleAI(testContest, 1L, "AI description", "int main(){return 1;}");
        Users aiUser = Users.builder().id(1L).email("ai@system.com").password("").build();

        when(contestRepository.findById(1L)).thenReturn(Optional.of(testContest));
        when(userRepository.findById(2L)).thenReturn(Optional.of(testUser));
        when(exampleAIRepository.findByContestIdOrderByExampleOrderAsc(any())).thenReturn(List.of(ai));
        when(userRepository.getReferenceById(1L)).thenReturn(aiUser);
        when(participantRepository.findByUserIdAndContestId(anyLong(), any())).thenReturn(Optional.empty());

        CodeSubmitRequest request = buildSubmitRequest("1", "2", Language.CPP, "int main(){return 0;}");

        ResponseEntity<CodeSubmitResponse> response = codeController.submitBattle(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().isSuccess()).isTrue();
        verify(submissionRepository).save(any());
        verify(matchRepository).save(any());
        verify(redisTemplate.opsForList()).leftPush(anyString(), anyString());
    }

    @Test
    @DisplayName("코드 제출 - 존재하지 않는 대회 ID이면 badRequest")
    void submitBattle_contestNotFound() {
        when(contestRepository.findById(999L)).thenReturn(Optional.empty());

        CodeSubmitRequest request = buildSubmitRequest("999", "2", Language.CPP, "int main(){return 0;}");

        ResponseEntity<CodeSubmitResponse> response = codeController.submitBattle(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().isSuccess()).isFalse();
        assertThat(response.getBody().getMessage()).contains("존재하지 않는 대회입니다.");
    }

    @Test
    @DisplayName("코드 제출 - 존재하지 않는 유저 ID이면 badRequest")
    void submitBattle_userNotFound() {
        when(contestRepository.findById(1L)).thenReturn(Optional.of(testContest));
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        CodeSubmitRequest request = buildSubmitRequest("1", "999", Language.CPP, "int main(){return 0;}");

        ResponseEntity<CodeSubmitResponse> response = codeController.submitBattle(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().isSuccess()).isFalse();
        assertThat(response.getBody().getMessage()).contains("존재하지 않는 유저입니다.");
    }

    @Test
    @DisplayName("코드 제출 - 대회에 등록된 예시 AI 없으면 badRequest")
    void submitBattle_noExampleAi() {
        when(contestRepository.findById(1L)).thenReturn(Optional.of(testContest));
        when(userRepository.findById(2L)).thenReturn(Optional.of(testUser));
        when(exampleAIRepository.findByContestIdOrderByExampleOrderAsc(any())).thenReturn(List.of());

        CodeSubmitRequest request = buildSubmitRequest("1", "2", Language.CPP, "int main(){return 0;}");

        ResponseEntity<CodeSubmitResponse> response = codeController.submitBattle(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().isSuccess()).isFalse();
        assertThat(response.getBody().getMessage()).contains("예시 AI가 없어 채점을 시작할 수 없습니다.");
    }

    // ─────────────────────────────────────────────────────────────
    // Helper
    // ─────────────────────────────────────────────────────────────

    private CodeSubmitRequest buildSubmitRequest(
            String problemId, String userId, Language language, String sourceCode) {
        CodeSubmitRequest req = new CodeSubmitRequest();
        req.setProblemId(problemId);
        req.setUserId(userId);
        req.setLanguage(language);
        req.setSourceCode(sourceCode);
        return req;
    }
}
