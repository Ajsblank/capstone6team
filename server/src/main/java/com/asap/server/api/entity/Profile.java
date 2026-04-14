package com.asap.server.api.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor
public class Profile {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne
  @JoinColumn(name = "user_id", foreignKey = @ForeignKey(name = "fk_profile_user"))
  private User user;

  @Column(length = 50)
  private String nickname;

  @Column(columnDefinition = "TEXT")
  private String bio;

  @Column
  private String image_url;

  @Column
  private LocalDateTime deleted_at;

  public Profile(User user, String nickname, String bio, String image_url) {
    this.user = user;
    this.nickname = nickname;
    this.bio = bio;
    this.image_url = image_url;
  }
}
