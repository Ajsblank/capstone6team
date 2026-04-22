package com.asap.server.service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.asap.server.config.JwtTokenProvider;
import com.asap.server.domain.Profile;
import com.asap.server.domain.Users;
import com.asap.server.dto.request.EmailVerifyRequest;
import com.asap.server.dto.request.LoginRequest;
import com.asap.server.dto.request.SignupRequest;
import com.asap.server.dto.response.LoginResponse;
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
    private final MailService mailService;
    private final Map<String, PendingSignup> pendingSignupStore = new ConcurrentHashMap<>();

    @Transactional
    public void signup(SignupRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("이미 가입된 이메일입니다.");
        }
        PendingSignup pending = new PendingSignup(
                request.getNickname(),
                passwordEncoder.encode(request.getPassword()));
        pendingSignupStore.put(request.getEmail(), pending);
        mailService.sendVerificationCode(request.getEmail());
        log.info("회원가입 요청 접수(미인증) - 이메일: {}, 닉네임: {}", request.getEmail(), request.getNickname());
    }

    @Transactional
    public void verifySignupMail(EmailVerifyRequest request) {
        PendingSignup pending = pendingSignupStore.get(request.getEmail());
        if (pending == null) {
            throw new IllegalArgumentException("회원가입 요청이 없습니다. 먼저 회원가입을 진행해주세요.");
        }

        boolean result = mailService.verifyCode(request.getEmail(), request.getCode());
        if (!result) {
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

        Profile profile = Profile.builder()
                .user(user)
                .nickname(pending.nickname())
                .build();
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
        String accessToken = jwtTokenProvider.createToken(user.getEmail());
        String refreshToken = jwtTokenProvider.createRefreshToken(user.getEmail());
        return new LoginResponse(accessToken, refreshToken);
    }
}