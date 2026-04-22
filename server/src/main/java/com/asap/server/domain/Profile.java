package com.asap.server.domain;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "profile")
@Getter
@NoArgsConstructor
public class Profile {

  @Id // Primary Key
  @Column(name = "user_id")
  private Long id;

  @OneToOne
  @MapsId
  @JoinColumn(name = "user_id")
  private Users user;

  @Column(length = 50, nullable = true)
  private String nickname;

  @Column(columnDefinition = "TEXT", nullable = true)
  private String bio;

  @Column(length = 50, nullable = true)
  private String affiliation;

  @Column(nullable = true)
  private String image_url;

  @Column(nullable = false)
  private LocalDateTime updated_at;

  @Builder
  public Profile(Users user, String nickname, String bio, String image_url, String affiliation) {
    this.user = user;
    this.nickname = nickname;
    this.bio = bio;
    this.image_url = image_url;
    this.affiliation = affiliation;
  }

  public void setUser(Users user) {
    this.user = user;
  }

  @PrePersist
  protected void onCreate() {
    updated_at = LocalDateTime.now();
  }

  @PreUpdate
  protected void onUpdate() {
    updated_at = LocalDateTime.now();
  }
}
