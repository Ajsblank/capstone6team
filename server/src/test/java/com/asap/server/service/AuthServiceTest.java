package com.asap.server.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
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
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.asap.server.config.JwtTokenProvider;
import com.asap.server.domain.Profile;
import com.asap.server.domain.Users;
import com.asap.server.dto.request.LoginRequest;
import com.asap.server.dto.request.SignupRequest;
import com.asap.server.dto.request.WithdrawRequest;
import com.asap.server.dto.response.LoginResponse;
import com.asap.server.repository.CodeBattleContestRepository;
import com.asap.server.repository.CodeBattleParticipantRepository;
import com.asap.server.repository.ContestReviewerRepository;
import com.asap.server.repository.usersRepository;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuthService 단위 테스트")
class AuthServiceTest {

    @Mock private usersRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtTokenProvider jwtTokenProvider;
    @Mock private TokenService tokenService;
    @Mock private MailService mailService;
    @Mock private SmsService smsService;
    @Mock private ProfileService profileService;
    @Mock private CodeBattleParticipantRepository participantRepository;
    @Mock private ContestReviewerRepository contestReviewerRepository;
    @Mock private CodeBattleContestRepository contestRepository;

    @InjectMocks
    private AuthService authService;

    private Users testUser;

    @BeforeEach
    void setUp() {
        testUser = Users.builder()
                .id(1L)
                .email("test@test.com")
                .password("encodedPassword")
                .build();

        Profile profile = Profile.builder()
                .user(testUser)
                .nickname("testnick")
                .tag(1)
                .build();
        testUser.setProfile(profile);
    }

    @Test
    @DisplayName("로그인 성공 시 access/refresh token 반환")
    void login_success() {
        LoginRequest request = new LoginRequest();
        request.setEmail("test@test.com");
        request.setPassword("password123");

        when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches("password123", "encodedPassword")).thenReturn(true);
        when(tokenService.issueAccessToken(any(), anyString())).thenReturn("access-token");
        when(tokenService.issueRefreshToken(any(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn("refresh-token");
        when(participantRepository.findContestIdsByUserId(any())).thenReturn(List.of());
        when(contestReviewerRepository.findContestIdsByReviewerEmail(anyString())).thenReturn(List.of());
        when(contestRepository.findContestIdsByCreatorId(any())).thenReturn(List.of());

        LoginResponse response = authService.login(request);

        assertThat(response.getAccessToken()).isEqualTo("access-token");
        assertThat(response.getRefreshToken()).isEqualTo("refresh-token");
        assertThat(response.getUserId()).isEqualTo(1L);
    }

    @Test
    @DisplayName("존재하지 않는 이메일로 로그인 시 예외 발생")
    void login_userNotFound() {
        LoginRequest request = new LoginRequest();
        request.setEmail("notfound@test.com");
        request.setPassword("password123");

        when(userRepository.findByEmail("notfound@test.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("이메일 또는 비밀번호가 일치하지 않습니다.");
    }

    @Test
    @DisplayName("비밀번호 불일치 시 로그인 예외 발생")
    void login_wrongPassword() {
        LoginRequest request = new LoginRequest();
        request.setEmail("test@test.com");
        request.setPassword("wrongPassword");

        when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches("wrongPassword", "encodedPassword")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("이메일 또는 비밀번호가 일치하지 않습니다.");
    }

    @Test
    @DisplayName("회원탈퇴 성공 시 유저 삭제")
    void withdraw_success() {
        WithdrawRequest request = new WithdrawRequest();
        request.setPassword("password123");

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches("password123", "encodedPassword")).thenReturn(true);

        authService.withdraw(1L, request);

        verify(userRepository).delete(testUser);
    }

    @Test
    @DisplayName("존재하지 않는 유저 탈퇴 시 예외 발생")
    void withdraw_userNotFound() {
        WithdrawRequest request = new WithdrawRequest();
        request.setPassword("password123");

        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.withdraw(99L, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("사용자를 찾을 수 없습니다.");
    }

    @Test
    @DisplayName("비밀번호 불일치 시 탈퇴 예외 발생")
    void withdraw_wrongPassword() {
        WithdrawRequest request = new WithdrawRequest();
        request.setPassword("wrongPassword");

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches("wrongPassword", "encodedPassword")).thenReturn(false);

        assertThatThrownBy(() -> authService.withdraw(1L, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("비밀번호가 일치하지 않습니다.");
    }

    @Test
    @DisplayName("이미 가입된 이메일로 회원가입 시 예외 발생")
    void signup_emailAlreadyExists() {
        SignupRequest request = new SignupRequest();
        request.setEmail("test@test.com");
        request.setPassword("password123");
        request.setNickname("nick");

        when(userRepository.existsByEmail("test@test.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.signup(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("이미 가입된 이메일입니다.");
    }

    @Test
    @DisplayName("신규 이메일로 회원가입 시 인증 메일 발송")
    void signup_newEmail_sendsMail() {
        SignupRequest request = new SignupRequest();
        request.setEmail("new@test.com");
        request.setPassword("password123");
        request.setNickname("newnick");

        when(userRepository.existsByEmail("new@test.com")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("encodedPassword");

        authService.signup(request);

        verify(mailService).sendVerificationCode("new@test.com");
    }
}
