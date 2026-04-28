package com.asap.server.controller;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import com.asap.server.domain.Profile;
import com.asap.server.domain.Users;
import com.asap.server.dto.request.UpdateProfileRequest;
import com.asap.server.dto.response.ProfileResponse;
import com.asap.server.repository.ProfileReposiroty;
import com.asap.server.repository.usersRepository;

@SpringBootTest
@ActiveProfiles("test")
class ProfileControllerIntegrationTest {

  @Autowired
  private ProfileController profileController;

  @Autowired
  private usersRepository userRepository;

  @Autowired
  private ProfileReposiroty profileRepository;

  @BeforeEach
  void setUp() {
    profileRepository.deleteAll();
    userRepository.deleteAll();

    Users user = Users.builder()
        .email("profile@test.com")
        .password("encoded-password")
        .build();

    Profile profile = Profile.builder()
        .user(user)
        .nickname("chito")
        .tag(1)
        .bio("init bio")
        .affiliation("ajou")
        .image_url("https://img.test/1.png")
        .build();
    user.setProfile(profile);

    userRepository.save(user);
  }

  @Test
  void getMyProfile_returnsCurrentProfile() {
    ProfileResponse body = profileController.getMyProfile("profile@test.com").getBody();

    assertThat(body).isNotNull();
    assertThat(body.getNickname()).isEqualTo("chito");
    assertThat(body.getTagCode()).isEqualTo("0001");
    assertThat(body.getNicknameTag()).isEqualTo("chito-0001");
  }

  @Test
  void patchMyProfile_updatesNicknameAndDetails() {
    UpdateProfileRequest request = new UpdateProfileRequest();
    request.setNickname("newchito");
    request.setBio("updated bio");
    request.setAffiliation("asap");
    request.setImageUrl("https://img.test/2.png");

    ProfileResponse body = profileController.patchMyProfile("profile@test.com", request).getBody();

    assertThat(body).isNotNull();
    assertThat(body.getNickname()).isEqualTo("newchito");
    assertThat(body.getTagCode()).isEqualTo("0001");
    assertThat(body.getBio()).isEqualTo("updated bio");
    assertThat(body.getAffiliation()).isEqualTo("asap");
  }

  @Test
  void getOtherProfile_returnsByNicknameTag() {
    ProfileResponse body = profileController.getOtherProfile("chito-0001").getBody();

    assertThat(body).isNotNull();
    assertThat(body.getNickname()).isEqualTo("chito");
    assertThat(body.getTag()).isEqualTo(1);
  }
}
