package com.asap.server.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import com.asap.server.domain.Profile;
import com.asap.server.domain.Users;
import com.asap.server.dto.request.LoginRequest;
import com.asap.server.dto.request.WithdrawRequest;
import com.asap.server.dto.response.LoginResponse;
import com.asap.server.repository.ProfileReposiroty;
import com.asap.server.repository.usersRepository;

@SpringBootTest
@ActiveProfiles("test")
class AuthControllerIntegrationTest {

  @Autowired
  private AuthController authController;

  @Autowired
  private PasswordEncoder passwordEncoder;

  @Autowired
  private usersRepository userRepository;

  @Autowired
  private ProfileReposiroty profileRepository;

  private Users loginUser;

  @BeforeEach
  void setUp() {
    profileRepository.deleteAll();
    userRepository.deleteAll();

    Users user = Users.builder()
        .email("auth@test.com")
        .password(passwordEncoder.encode("password123"))
        .build();

    Profile profile = Profile.builder()
        .user(user)
        .nickname("authnick")
        .tag(1)
        .build();
    user.setProfile(profile);

    loginUser = userRepository.save(user);
  }

  @Test
  void login_returnsAccessAndRefreshToken() {
    LoginRequest request = new LoginRequest();
    request.setEmail("auth@test.com");
    request.setPassword("password123");

    LoginResponse body = authController.login(request).getBody();

    assertThat(body).isNotNull();
    assertThat(body.getAccessToken()).isNotBlank();
    assertThat(body.getRefreshToken()).isNotBlank();
  }

  @Test
  void login_failsWithBadPassword() {
    LoginRequest request = new LoginRequest();
    request.setEmail("auth@test.com");
    request.setPassword("wrong-password");

    assertThatThrownBy(() -> authController.login(request))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("이메일 또는 비밀번호가 일치하지 않습니다.");
  }

  @Test
  void withdraw_deletesUserWhenPasswordMatches() {
    WithdrawRequest request = new WithdrawRequest();
    request.setPassword("password123");

    authController.withdraw(loginUser.getEmail(), request);
    assertThat(userRepository.findByEmail("auth@test.com")).isEmpty();
  }
}
