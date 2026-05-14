package com.asap.server.dto.response;

import com.asap.server.domain.Profile;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ProfileResponse {

  private Long userId;
  private String nickname;
  private Integer tag;
  private String tagCode;
  private String nicknameTag;
  private String profileUrl;
  private String bio;
  private String affiliation;
  private String imageUrl;

  public static ProfileResponse from(Profile profile) {
    String tagCode = String.format("%04d", profile.getTag());
    String nicknameTag = profile.getNickname() + "-" + tagCode;
    return ProfileResponse.builder()
        .userId(profile.getId())
        .nickname(profile.getNickname())
        .tag(profile.getTag())
        .tagCode(tagCode)
        .nicknameTag(nicknameTag)
        .profileUrl("/api/profile/" + nicknameTag)
        .bio(profile.getBio())
        .affiliation(profile.getAffiliation())
        .imageUrl(profile.getImage_url())
        .build();
  }
}
