package com.asap.server.domain;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "code_battle_match", uniqueConstraints = {
    @UniqueConstraint(name = "uk_match_contest_user_pair", columnNames = { "contest_id", "user1_id", "user2_id" })
})
@Getter
@Setter
@NoArgsConstructor
public class CodeBattleMatch {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "contest_id", foreignKey = @ForeignKey(name = "fk_match_contest"))
  private CodeBattleContest contest;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user1_id", foreignKey = @ForeignKey(name = "fk_match_user1"))
  private Users user1;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user2_id", foreignKey = @ForeignKey(name = "fk_match_user2"))
  private Users user2;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "winner_id", foreignKey = @ForeignKey(name = "fk_match_winner"))
  private Users winner;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "submission_id", foreignKey = @ForeignKey(name = "fk_match_submission"))
  private CodeBattleSubmission submission;

  @Column(columnDefinition = "TEXT")
  private String log;

  private Integer aiOrder;

  @Column(nullable = false)
  private LocalDateTime created_at;

  public CodeBattleMatch(CodeBattleContest contest, Users user1, Users user2, Users winner, String log, Integer aiOrder) {
    this.contest = contest;
    this.user1 = user1;
    this.user2 = user2;
    this.winner = winner;
    this.log = log;
    this.aiOrder = aiOrder;
  }

  @PrePersist
  protected void onCreate() {
    created_at = LocalDateTime.now();
  }
}