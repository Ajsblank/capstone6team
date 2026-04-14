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
import jakarta.persistence.PrePersist;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor
public class Submission {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne
  @JoinColumn(name = "user_id", foreignKey = @ForeignKey(name = "fk_submission_user"))
  private User user;

  @ManyToOne
  @JoinColumn(name = "contest_id", foreignKey = @ForeignKey(name = "fk_submission_contest"))
  private Contest contest;

  @Column
  private String code_url;

  @Column
  private String result;

  @Column(nullable = false)
  private LocalDateTime created_at;

  public Submission(User user, Contest contest, String code_url, String result) {
    this.user = user;
    this.contest = contest;
    this.code_url = code_url;
    this.result = result;
  }

  @PrePersist
  protected void onCreate() {
    created_at = LocalDateTime.now();
  }
}
