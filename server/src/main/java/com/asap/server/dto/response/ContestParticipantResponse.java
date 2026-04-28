package com.asap.server.dto.response;

import java.time.LocalDateTime;

import com.asap.server.domain.CodeBattleParticipant;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ContestParticipantResponse {

  private Long participant_id;
  private Long user_id;
  private String email;
  private String nickname;
  private Integer tag;
  private String nickname_tag;
  private Integer score;
  private LocalDateTime joined_at;

  public static ContestParticipantResponse from(CodeBattleParticipant participant) {
    String nickname = participant.getUser().getProfile().getNickname();
    int tag = participant.getUser().getProfile().getTag();
    String tagCode = String.format("%04d", tag);

    return ContestParticipantResponse.builder()
      .participant_id(participant.getId())
      .user_id(participant.getUser().getId())
        .email(participant.getUser().getEmail())
        .nickname(nickname)
        .tag(tag)
      .nickname_tag(nickname + "-" + tagCode)
        .score(participant.getScore())
      .joined_at(participant.getCreated_at())
        .build();
  }
}
