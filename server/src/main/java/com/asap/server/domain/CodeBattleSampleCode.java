package com.asap.server.domain;

import java.time.LocalDateTime;

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
@Table(name = "code_battle_sample_code")
@Getter
@NoArgsConstructor
public class CodeBattleSampleCode {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne
  @JoinColumn(name = "contest_id", foreignKey = @ForeignKey(name = "fk_contest_sample_code_contest"))
  private CodeBattleContest contest;

  @Column(name = "sample_order")
  private Long sampleOrder;

  @Enumerated(EnumType.STRING)
  @JdbcTypeCode(SqlTypes.NAMED_ENUM)
  @Column(columnDefinition = "language", nullable = false)
  private Language language = Language.CPP;

  @Column(columnDefinition = "TEXT")
  private String code;

  @Column(nullable = false)
  private LocalDateTime created_at;

  public CodeBattleSampleCode(CodeBattleContest contest, Long sampleOrder, String code, Language language) {
    this.contest = contest;
    this.sampleOrder = sampleOrder;
    this.code = code;
    this.language = language;
  }

  @PrePersist
  protected void onCreate() {
    created_at = LocalDateTime.now();
  }
}
