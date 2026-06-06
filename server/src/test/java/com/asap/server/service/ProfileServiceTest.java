package com.asap.server.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.asap.server.domain.Profile;
import com.asap.server.domain.Users;
import com.asap.server.dto.request.UpdateProfileRequest;
import com.asap.server.dto.response.ProfileResponse;
import com.asap.server.repository.ProfileReposiroty;
import com.asap.server.repository.usersRepository;

@ExtendWith(MockitoExtension.class)
@DisplayName("ProfileService 단위 테스트")
class ProfileServiceTest {

    @Mock
    private usersRepository userRepository;
    @Mock
    private ProfileReposiroty profileRepository;

    @InjectMocks
    private ProfileService profileService;

    private Users testUser;
    private Profile testProfile;

    @BeforeEach
    void setUp() {
        testUser = Users.builder()
                .id(1L)
                .email("test@test.com")
                .password("encodedPassword")
                .build();

        testProfile = Profile.builder()
                .user(testUser)
                .nickname("testnick")
                .tag(1)
                .bio("bio")
                .affiliation("ajou")
                .build();

        testUser.setProfile(testProfile);
    }

    // ─────────────────────────────────────────────────────────────
    // getMyProfile
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("내 프로필 조회 성공")
    void getMyProfile_success() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));

        ProfileResponse response = profileService.getMyProfile(1L);

        assertThat(response.getNickname()).isEqualTo("testnick");
        assertThat(response.getTag()).isEqualTo(1);
        assertThat(response.getBio()).isEqualTo("bio");
    }

    @Test
    @DisplayName("존재하지 않는 유저 프로필 조회 시 예외 발생")
    void getMyProfile_userNotFound() {
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> profileService.getMyProfile(999L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("사용자를 찾을 수 없습니다.");
    }

    @Test
    @DisplayName("프로필이 없는 유저 조회 시 예외 발생")
    void getMyProfile_profileNull() {
        Users userWithoutProfile = Users.builder()
                .id(2L)
                .email("noprofile@test.com")
                .password("encodedPassword")
                .build();

        when(userRepository.findById(2L)).thenReturn(Optional.of(userWithoutProfile));

        assertThatThrownBy(() -> profileService.getMyProfile(2L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("프로필이 존재하지 않습니다.");
    }

    // ─────────────────────────────────────────────────────────────
    // updateMyProfile
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("닉네임 변경 시 새 태그 할당 후 저장, ")
    void updateMyProfile_nicknameChanged() {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setNickname("newnick");
        request.setBio("newbio");

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(profileRepository.findMaxTagByNickname("newnick")).thenReturn(0);
        when(profileRepository.save(any(Profile.class))).thenReturn(testProfile);

        ProfileResponse response = profileService.updateMyProfile(1L, request);

        assertThat(response).isNotNull();
        verify(profileRepository).save(any(Profile.class));
    }

    @Test
    @DisplayName("같은 닉네임 유지 시 태그 재할당 없이 저장")
    void updateMyProfile_sameNickname() {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setNickname("testnick");
        request.setBio("updatedbio");

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(profileRepository.save(any(Profile.class))).thenReturn(testProfile);

        ProfileResponse response = profileService.updateMyProfile(1L, request);

        assertThat(response).isNotNull();
    }

    @Test
    @DisplayName("닉네임이 null이면 기존 닉네임 유지")
    void updateMyProfile_nullNickname() {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setNickname(null);
        request.setBio("newbio");

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(profileRepository.save(any(Profile.class))).thenReturn(testProfile);

        ProfileResponse response = profileService.updateMyProfile(1L, request);
        assertThat(response.getNickname()).isEqualTo("testnick");

    }

    @Test
    @DisplayName("닉네임이 공백만 있으면 기존 닉네임 유지")
    void updateMyProfile_blankNickname() {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setNickname("   ");
        request.setBio("newbio");

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(profileRepository.save(any(Profile.class))).thenReturn(testProfile);

        ProfileResponse response = profileService.updateMyProfile(1L, request);

        assertThat(response.getNickname()).isEqualTo("testnick");
    }

    @Test
    @DisplayName("닉네임이 9999개 태그를 모두 소진하면 예외 발생")
    void updateMyProfile_tagExhausted() {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setNickname("fullnick");

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(profileRepository.findMaxTagByNickname("fullnick")).thenReturn(9999);

        assertThatThrownBy(() -> profileService.updateMyProfile(1L, request))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("태그(0001~9999)를 모두 사용했습니다.");
    }

    // ─────────────────────────────────────────────────────────────
    // getOtherProfile
    // ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("닉네임-태그 형식으로 타인 프로필 조회 성공")
    void getOtherProfile_success() {
        when(profileRepository.findByNicknameAndTag("testnick", 1)).thenReturn(Optional.of(testProfile));

        ProfileResponse response = profileService.getOtherProfile("testnick-0001");

        assertThat(response.getNickname()).isEqualTo("testnick");
        assertThat(response.getTag()).isEqualTo(1);
    }

    @Test
    @DisplayName("구분자(-) 없는 형식으로 조회 시 예외 발생")
    void getOtherProfile_noSeparator() {
        assertThatThrownBy(() -> profileService.getOtherProfile("testnick0001"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("요청 형식이 올바르지 않습니다.");
    }

    @Test
    @DisplayName("태그가 4자리 숫자가 아닌 경우 예외 발생")
    void getOtherProfile_tagNotFourDigits() {
        assertThatThrownBy(() -> profileService.getOtherProfile("testnick-123"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("태그는 4자리 숫자여야 합니다.");
    }

    @Test
    @DisplayName("해당 프로필이 없으면 예외 발생")
    void getOtherProfile_notFound() {
        when(profileRepository.findByNicknameAndTag("unknown", 1)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> profileService.getOtherProfile("unknown-0001"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("해당 프로필을 찾을 수 없습니다.");
    }

    @Test
    @DisplayName("태그 범위(0001~9999) 초과 시 예외 발생")
    void getOtherProfile_tagOutOfRange() {
        assertThatThrownBy(() -> profileService.getOtherProfile("testnick-0000"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("태그는 0001~9999 범위여야 합니다.");
    }
}
