package com.asap.server.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doNothing;
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

import org.springframework.test.util.ReflectionTestUtils;

import com.asap.server.config.JwtTokenProvider;
import com.asap.server.domain.Profile;
import com.asap.server.domain.Users;
import com.asap.server.dto.request.EmailResendRequest;
import com.asap.server.dto.request.EmailVerifyRequest;
import com.asap.server.dto.request.LoginRequest;
import com.asap.server.dto.request.SignupRequest;
import com.asap.server.dto.request.SmsCodeVerifyRequest;
import com.asap.server.dto.request.SmsVerifyRequest;
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

    // ─────────────────────────────────────────────────────────────
    // verifySignupMail
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("이메일 인증 - 가입 요청 없음 예외")
    void verifySignupMail_noPending() {
        EmailVerifyRequest request = new EmailVerifyRequest();
        ReflectionTestUtils.setField(request, "email", "notsignedup@test.com");
        ReflectionTestUtils.setField(request, "code", "123456");

        assertThatThrownBy(() -> authService.verifySignupMail(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("회원가입 요청이 없습니다.");
    }

    @Test
    @DisplayName("이메일 인증 - 인증번호 불일치 예외")
    void verifySignupMail_wrongCode() {
        SignupRequest signupRequest = new SignupRequest();
        signupRequest.setEmail("pending@test.com");
        signupRequest.setPassword("pw");
        signupRequest.setNickname("nick");
        when(userRepository.existsByEmail("pending@test.com")).thenReturn(false);
        when(passwordEncoder.encode("pw")).thenReturn("encoded");
        authService.signup(signupRequest);

        EmailVerifyRequest request = new EmailVerifyRequest();
        ReflectionTestUtils.setField(request, "email", "pending@test.com");
        ReflectionTestUtils.setField(request, "code", "wrong");
        when(mailService.verifyCode("pending@test.com", "wrong")).thenReturn(false);

        assertThatThrownBy(() -> authService.verifySignupMail(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("인증번호가 일치하지 않습니다.");
    }

    @Test
    @DisplayName("이메일 인증 성공 - 유저 저장")
    void verifySignupMail_success() {
        SignupRequest signupRequest = new SignupRequest();
        signupRequest.setEmail("verify@test.com");
        signupRequest.setPassword("pw");
        signupRequest.setNickname("nick");
        when(userRepository.existsByEmail("verify@test.com")).thenReturn(false);
        when(passwordEncoder.encode("pw")).thenReturn("encoded");
        authService.signup(signupRequest);

        EmailVerifyRequest request = new EmailVerifyRequest();
        ReflectionTestUtils.setField(request, "email", "verify@test.com");
        ReflectionTestUtils.setField(request, "code", "123456");
        when(mailService.verifyCode("verify@test.com", "123456")).thenReturn(true);
        when(userRepository.existsByEmail("verify@test.com")).thenReturn(false);
        when(profileService.createProfile(any(), anyString()))
                .thenReturn(Profile.builder().nickname("nick").tag(1).build());

        authService.verifySignupMail(request);

        verify(userRepository).save(any(Users.class));
    }

    // ─────────────────────────────────────────────────────────────
    // resendMail
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("이메일 재발송 - 가입 요청 없음 예외")
    void resendMail_noPending() {
        EmailResendRequest request = new EmailResendRequest();
        request.setEmail("nobody@test.com");

        assertThatThrownBy(() -> authService.resendMail(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("회원가입 요청이 없습니다.");
    }

    @Test
    @DisplayName("이메일 재발송 성공")
    void resendMail_success() {
        // signup으로 pending 등록
        SignupRequest signupRequest = new SignupRequest();
        signupRequest.setEmail("resend@test.com");
        signupRequest.setPassword("pw");
        signupRequest.setNickname("nick");
        when(userRepository.existsByEmail("resend@test.com")).thenReturn(false);
        when(passwordEncoder.encode("pw")).thenReturn("encoded");
        authService.signup(signupRequest);
        clearInvocations(mailService); // signup 호출 카운트 초기화

        EmailResendRequest request = new EmailResendRequest();
        request.setEmail("resend@test.com");
        when(userRepository.existsByEmail("resend@test.com")).thenReturn(false);

        authService.resendMail(request);

        verify(mailService).sendVerificationCode("resend@test.com");
    }

    // ─────────────────────────────────────────────────────────────
    // logout / logoutAll
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("로그아웃 성공")
    void logout_success() {
        authService.logout(1L, "access-token", "sess1");

        verify(tokenService).blacklistAccessToken("access-token");
        verify(tokenService).revokeSession(1L, "sess1");
    }

    @Test
    @DisplayName("모든 세션 로그아웃 성공")
    void logoutAll_success() {
        authService.logoutAll(1L);

        verify(tokenService).revokeAllUserSessions(1L);
    }

    // ─────────────────────────────────────────────────────────────
    // sendSMS / verifySMS
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("SMS 인증번호 발송 성공")
    void sendSMS_success() {
        SmsVerifyRequest request = new SmsVerifyRequest();
        doNothing().when(smsService).sendSMS(request);

        authService.sendSMS(request);

        verify(smsService).sendSMS(request);
    }

    @Test
    @DisplayName("SMS 인증 완료 성공")
    void verifySMS_success() {
        SmsCodeVerifyRequest request = new SmsCodeVerifyRequest();
        doNothing().when(smsService).verifySMS(request);

        authService.verifySMS(request);

        verify(smsService).verifySMS(request);
    }
}
