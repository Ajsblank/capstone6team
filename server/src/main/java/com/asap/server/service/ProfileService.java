package com.asap.server.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.asap.server.domain.Profile;
import com.asap.server.domain.Users;
import com.asap.server.dto.request.UpdateProfileRequest;
import com.asap.server.dto.response.ProfileResponse;
import com.asap.server.repository.ProfileReposiroty;
import com.asap.server.repository.usersRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ProfileService {

  private final usersRepository userRepository;
  private final ProfileReposiroty profileRepository;

  @Transactional(readOnly = true)
  public ProfileResponse getMyProfile(String email) {
    Users user = userRepository.findByEmail(email)
        .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

    Profile profile = user.getProfile();
    if (profile == null) {
      throw new IllegalArgumentException("프로필이 존재하지 않습니다.");
    }

    return ProfileResponse.from(profile);
  }

  @Transactional
  public ProfileResponse updateMyProfile(String email, UpdateProfileRequest request) {
    Users user = userRepository.findByEmail(email)
        .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

    String newNickname = normalizeNickname(request.getNickname());
    if (newNickname == null) {
      throw new IllegalArgumentException("닉네임은 필수입니다.");
    }

    Profile profile = user.getProfile();
    if (profile == null) {
      int tag = allocateNextTag(newNickname);
      Profile newProfile = Profile.builder()
          .user(user)
          .nickname(newNickname)
          .tag(tag)
          .bio(request.getBio())
          .affiliation(request.getAffiliation())
          .image_url(request.getImageUrl())
          .build();
      user.setProfile(newProfile);
      userRepository.save(user);
      return ProfileResponse.from(newProfile);
    }

    if (!newNickname.equals(profile.getNickname())) {
      int newTag = allocateNextTag(newNickname);
      profile.updateNicknameAndTag(newNickname, newTag);
    }

    profile.updateDetails(request.getBio(), request.getAffiliation(), request.getImageUrl());
    Profile updated = profileRepository.save(profile);
    return ProfileResponse.from(updated);
  }

  @Transactional(readOnly = true)
  public ProfileResponse getOtherProfile(String nicknameTag) {
    ParsedNicknameTag parsed = parseNicknameTag(nicknameTag);
    Profile profile = profileRepository.findByNicknameAndTag(parsed.nickname(), parsed.tag())
        .orElseThrow(() -> new IllegalArgumentException("해당 프로필을 찾을 수 없습니다."));

    return ProfileResponse.from(profile);
  }

  public Profile createProfile(Users user, String nickname) {
    int tag = allocateNextTag(nickname);
    return Profile.builder()
        .user(user)
        .nickname(nickname)
        .tag(tag)
        .build();
  }

  private int allocateNextTag(String nickname) {
    int maxTag = profileRepository.findMaxTagByNickname(nickname);
    if (maxTag >= 9999) {
      throw new IllegalStateException("해당 닉네임은 사용할 수 있는 태그(0001~9999)를 모두 사용했습니다.");
    }
    return maxTag + 1;
  }

  private String normalizeNickname(String nickname) {
    if (nickname == null) {
      return null;
    }
    String trimmed = nickname.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  private ParsedNicknameTag parseNicknameTag(String nicknameTag) {
    int separator = nicknameTag.lastIndexOf('-');
    if (separator <= 0 || separator == nicknameTag.length() - 1) {
      throw new IllegalArgumentException("요청 형식이 올바르지 않습니다. 예: /api/profile/chito-0001");
    }

    String nickname = nicknameTag.substring(0, separator).trim();
    String tagPart = nicknameTag.substring(separator + 1).trim();

    if (nickname.isEmpty()) {
      throw new IllegalArgumentException("닉네임이 비어있습니다.");
    }

    if (!tagPart.matches("\\d{4}")) {
      throw new IllegalArgumentException("태그는 4자리 숫자여야 합니다. 예: 0001");
    }

    int tag;
    try {
      tag = Integer.parseInt(tagPart);
    } catch (NumberFormatException e) {
      throw new IllegalArgumentException("태그는 숫자여야 합니다.");
    }

    if (tag < 1 || tag > 9999) {
      throw new IllegalArgumentException("태그는 0001~9999 범위여야 합니다.");
    }

    return new ParsedNicknameTag(nickname, tag);
  }

  private record ParsedNicknameTag(String nickname, int tag) {
  }
}
