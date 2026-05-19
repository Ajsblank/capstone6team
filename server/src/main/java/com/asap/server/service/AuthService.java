package com.asap.server.service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
import com.asap.server.repository.CodeBattleParticipantRepository;
import com.asap.server.repository.ContestReviewerRepository;
import com.asap.server.repository.usersRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private record PendingSignup(String nickname, String encodedPassword) {
    }

    private final usersRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final TokenService tokenService;
    private final MailService mailService;
    private final SmsService smsService;
    private final ProfileService profileService;
    private final CodeBattleParticipantRepository participantRepository;
    private final ContestReviewerRepository contestReviewerRepository;
    private final Map<String, PendingSignup> pendingSignupStore = new ConcurrentHashMap<>();

    @Transactional
    public void signup(SignupRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            log.info("이미 가입된 이메일입니다.");
            throw new IllegalArgumentException("이미 가입된 이메일입니다.");
        }
        PendingSignup pending = new PendingSignup(
                request.getNickname(),
                passwordEncoder.encode(request.getPassword()));
        pendingSignupStore.put(request.getEmail(), pending);
        sendVerificationCodeWithLog(request.getEmail(), request.getNickname(), false);
    }

    public void resendMail(EmailResendRequest request) {

        PendingSignup pending = pendingSignupStore.get(request.getEmail());
        if (pending == null) {
            throw new IllegalArgumentException("회원가입 요청이 없습니다. 먼저 회원가입을 진행해주세요.");
        }

        if (userRepository.existsByEmail(request.getEmail())) {
            pendingSignupStore.remove(request.getEmail());
            throw new IllegalArgumentException("이미 가입된 이메일입니다.");
        }

        sendVerificationCodeWithLog(request.getEmail(), pending.nickname(), true);
    }

    @Transactional
    public void verifySignupMail(EmailVerifyRequest request) {
        PendingSignup pending = pendingSignupStore.get(request.getEmail());
        if (pending == null) {
            throw new IllegalArgumentException("회원가입 요청이 없습니다. 먼저 회원가입을 진행해주세요.");
        }

        if (!mailService.verifyCode(request.getEmail(), request.getCode())) {
            throw new IllegalArgumentException("인증번호가 일치하지 않습니다.");
        }

        if (userRepository.existsByEmail(request.getEmail())) {
            pendingSignupStore.remove(request.getEmail());
            throw new IllegalArgumentException("이미 가입된 이메일입니다.");
        }

        Users user = Users.builder()
                .email(request.getEmail())
                .password(pending.encodedPassword())
                .build();

        Profile profile = profileService.createProfile(user, pending.nickname());
        user.setProfile(profile);

        userRepository.save(user);
        pendingSignupStore.remove(request.getEmail());
        log.info("회원가입 인증 완료 및 DB 저장 - 이메일: {}, 닉네임: {}", request.getEmail(), pending.nickname());
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        Users user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("이메일 또는 비밀번호가 일치하지 않습니다."));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("이메일 또는 비밀번호가 일치하지 않습니다.");
        }

        Profile profile = user.getProfile();
        log.info("로그인 성공 - 닉네임: {}", profile.getNickname());

        String sessionId = java.util.UUID.randomUUID().toString();
        String accessToken = tokenService.issueAccessToken(user.getId(), user.getEmail());
        String refreshToken = tokenService.issueRefreshToken(user.getId(), user.getEmail(), sessionId, "", "");

        List<Long> joinedContests = participantRepository.findContestIdsByUserId(user.getId());
        log.info("참가 대회 조회 - userId: {}, joinedContests: {}", user.getId(), joinedContests);

        List<Long> hostedContests = contestReviewerRepository.findContestIdsByReviewerEmail(user.getEmail());
        log.info("개최 대회 조회(reviewer_email 기준) - userId: {}, email: {}, hostedContests: {}", user.getId(),
                user.getEmail(), hostedContests);

        LoginResponse response = LoginResponse.builder()
                .userId(user.getId())
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .sessionId(sessionId)
                .joinedContests(joinedContests)
                .hostedContests(hostedContests)
                .build();
        log.info(
                "로그인 응답 - userId: {}, accessToken: {}, refreshToken: {}, sessionId: {}, joinedContests: {}, hostedContests: {}",
                response.getUserId(), response.getAccessToken(), response.getRefreshToken(),
                response.getSessionId(), response.getJoinedContests(), response.getHostedContests());
        return response;
    }

    public void logout(String accessToken, String sessionId) {
        tokenService.blacklistAccessToken(accessToken);
        // sessionId에서 userId 추출 필요하면 토큰에서 추출
        log.info("로그아웃 완료 - sessionId: {}", sessionId);
    }

    public void logoutAll(Long userId) {
        tokenService.revokeAllUserSessions(userId);
        log.info("모든 세션 로그아웃 - userId: {}", userId);
    }

    @Transactional
    public void withdraw(Long userId, WithdrawRequest request) {
        Users user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("비밀번호가 일치하지 않습니다.");
        }

        userRepository.delete(user);
        log.info("회원탈퇴 완료 - userId: {}", userId);
    }

    private void sendVerificationCodeWithLog(String email, String nickname, boolean resent) {
        mailService.sendVerificationCode(email);
        if (resent) {
            log.info("회원가입 인증번호 재발송 완료 - 이메일: {}, 닉네임: {}", email, nickname);
            return;
        }
        log.info("회원가입 인증번호 발송 완료 - 이메일: {}, 닉네임: {}", email, nickname);
    }

    public void sendSMS(SmsVerifyRequest request) {
        smsService.sendSMS(request);
    }

    public void verifySMS(SmsCodeVerifyRequest request) {
        smsService.verifySMS(request);
    }

}