package com.asap.server.dto.response;

import com.asap.server.domain.Profile;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ProfileResponse {

  private Long user_id;
  private String nickname;
  private Integer tag;
  private String tag_code;
  private String nickname_tag;
  private String profile_url;
  private String bio;
  private String affiliation;
  private String image_url;

  public static ProfileResponse from(Profile profile) {
    String tag_code = String.format("%04d", profile.getTag());
    String nickname_tag = profile.getNickname() + "-" + tag_code;
    return ProfileResponse.builder()
      .user_id(profile.getId())
        .nickname(profile.getNickname())
        .tag(profile.getTag())
      .tag_code(tag_code)
      .nickname_tag(nickname_tag)
      .profile_url("/api/profile/" + nickname_tag)
        .bio(profile.getBio())
        .affiliation(profile.getAffiliation())
      .image_url(profile.getImage_url())
        .build();
  }
}
