package com.asap.server.dto.response;

import java.time.LocalDateTime;

import com.asap.server.domain.CodeBattleParticipant;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ContestParticipantResponse {

  private Long participantId;
  private Long userId;
  private String email;
  private String nickname;
  private Integer tag;
  private String nicknameTag;
  private Integer score;
  private LocalDateTime joinedAt;

  public static ContestParticipantResponse from(CodeBattleParticipant participant) {
    String nickname = participant.getUser().getProfile().getNickname();
    int tag = participant.getUser().getProfile().getTag();
    String tagCode = String.format("%04d", tag);

    return ContestParticipantResponse.builder()
        .participantId(participant.getId())
        .userId(participant.getUser().getId())
        .email(participant.getUser().getEmail())
        .nickname(nickname)
        .tag(tag)
        .nicknameTag(nickname + "-" + tagCode)
        .score(participant.getScore())
        .joinedAt(participant.getCreated_at())
        .build();
  }
}
