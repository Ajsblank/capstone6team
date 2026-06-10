package com.asap.server.service;

import java.security.SecureRandom;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.asap.server.domain.Profile;
import com.asap.server.domain.Users;
import com.asap.server.dto.request.AdminCreateUserRequest;
import com.asap.server.repository.usersRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminService {

    private final usersRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ProfileService profileService;
    private final MailService mailService;
    private final TokenService tokenService;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    private static final String PASSWORD_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
    private static final SecureRandom random = new SecureRandom();

    @Transactional
    public void createUserByAdmin(AdminCreateUserRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("이미 가입된 이메일입니다.");
        }

        String rawPassword = generateRandomPassword(12);

        Users user = Users.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(rawPassword))
                .build();

        Profile profile = profileService.createProfile(user, request.getNickname());
        user.setProfile(profile);
        userRepository.save(user);

        String inviteToken = UUID.randomUUID().toString();
        tokenService.storeInviteToken(inviteToken, user.getId());

        String autoLoginUrl = frontendUrl + "/auto-login?token=" + inviteToken;
        mailService.sendAccountInviteMail(request.getEmail(), request.getNickname(), rawPassword, autoLoginUrl);

        log.info("관리자에 의한 계정 생성 완료 - email: {}, nickname: {}", request.getEmail(), request.getNickname());
    }

    private String generateRandomPassword(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(PASSWORD_CHARS.charAt(random.nextInt(PASSWORD_CHARS.length())));
        }
        return sb.toString();
    }
}
