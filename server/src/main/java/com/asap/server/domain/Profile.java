package com.asap.server.domain;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor
public class Profile {

  @Id
  private Long userId;

  @OneToOne
  @MapsId
  @JoinColumn(name = "user_id", foreignKey = @ForeignKey(name = "fk_profile_user"))
  private users user;

  @Column(length = 50)
  private String nickname;

  @Column(columnDefinition = "TEXT")
  private String bio;

  @Column
  private String image_url;

  @Column
  private LocalDateTime deleted_at;

  @Builder
  public Profile(users user, String nickname, String bio, String image_url) {
    this.user = user;
    this.nickname = nickname;
    this.bio = bio;
    this.image_url = image_url;
  }

  public void setUser(users user) {
    this.user = user;
  }
}
