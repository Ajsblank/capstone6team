package com.asap.server.domain;

import java.time.LocalDateTime;
import java.util.Objects;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.asap.server.global.type.Language;

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
  @JdbcTypeCode(SqlTypes.NAMED_ENUM)
  @Column(columnDefinition = "language", nullable = false)
  private Language language;

  @Column(name = "code_url", columnDefinition = "TEXT")
  private String codeUrl;

  @Column
  private String result;

  @Column(name = "created_at")
  private LocalDateTime createdAt;

  public CodeBattleSubmission(Users user, CodeBattleContest contest, Language language, String codeUrl,
      String result) {
    this.user = user;
    this.contest = contest;
    this.language = Objects.requireNonNull(language, "language는 null일 수 없습니다.");
    this.codeUrl = codeUrl;
    this.result = result;
  }

  public void changeCodeUrl(String codeUrl) {
    this.codeUrl = codeUrl;
  }

  @PrePersist
  protected void onCreate() {
    createdAt = LocalDateTime.now();
  }
}
