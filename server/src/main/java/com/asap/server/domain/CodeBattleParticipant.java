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
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor
@Table(name = "code_battle_participant", uniqueConstraints = {
    @UniqueConstraint(name = "uk_participant_user_contest", columnNames = { "user_id", "contest_id" })
})
public class CodeBattleParticipant {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne
  @JoinColumn(name = "user_id", foreignKey = @ForeignKey(name = "fk_participant_user"))
  private Users user;

  @ManyToOne
  @JoinColumn(name = "contest_id", foreignKey = @ForeignKey(name = "fk_participant_contest"))
  private CodeBattleContest contest;

  @ManyToOne
  @JoinColumn(name = "submission_id", foreignKey = @ForeignKey(name = "fk_participant_submission"))
  private CodeBattleSubmission submission;

  @Column
  private Integer score;

  @Column(nullable = false)
  private LocalDateTime created_at;

  public CodeBattleParticipant(Users user, CodeBattleContest contest, Integer score, CodeBattleSubmission submission) {
    this.user = user;
    this.contest = contest;
    this.score = score;
    this.submission = submission;
  }

  @PrePersist
  protected void onCreate() {
    created_at = LocalDateTime.now();
  }
}
