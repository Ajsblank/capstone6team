package com.asap.server.domain;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "code_battle_submission")
@Getter
@NoArgsConstructor
public class CodeBattleSubmission {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne
  @JoinColumn(name = "user_id", foreignKey = @ForeignKey(name = "fk_submission_user"))
  private Users user;

  @ManyToOne
  @JoinColumn(name = "contest_id", foreignKey = @ForeignKey(name = "fk_submission_contest"))
  private CodeBattleContest contest;

  @Enumerated(EnumType.STRING)
  @Column
  private CodeLanguage language;

  @Column
  private String code;

  @Column
  private String result;

  @Column(nullable = false)
  private LocalDateTime created_at;

  public CodeBattleSubmission(Users user, CodeBattleContest contest, CodeLanguage language, String code,
      String result) {
    this.user = user;
    this.contest = contest;
    this.language = language;
    this.code = code;
    this.result = result;
  }

  @PrePersist
  protected void onCreate() {
    created_at = LocalDateTime.now();
  }
}
