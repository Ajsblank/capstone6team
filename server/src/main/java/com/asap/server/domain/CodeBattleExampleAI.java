package com.asap.server.domain;

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
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "code_battle_example_ai")
@Getter
@NoArgsConstructor
public class CodeBattleExampleAI {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne
  @JoinColumn(name = "contest_id", foreignKey = @ForeignKey(name = "fk_contest_example_ai_contest"))
  private CodeBattleContest contest;

  @Column(name = "example_order")
  private Integer exampleOrder;

  @Column(columnDefinition = "TEXT")
  private String description;

  @Column(columnDefinition = "TEXT")
  private String code;

  @Column(nullable = false)
  private LocalDateTime created_at;

  public CodeBattleExampleAI(CodeBattleContest contest, Integer exampleOrder, String description, String code) {
    this.contest = contest;
    this.exampleOrder = exampleOrder;
    this.description = description;
    this.code = code;
  }

  @PrePersist
  protected void onCreate() {
    created_at = LocalDateTime.now();
  }
}
