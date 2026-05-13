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
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "contest_final_submission")
@Getter
@NoArgsConstructor
public class ContestFinalSubmission {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne
  @JoinColumn(name = "user_id", foreignKey = @ForeignKey(name = "fk_final_user"))
  private Users user;

  @ManyToOne
  @JoinColumn(name = "contest_id", foreignKey = @ForeignKey(name = "fk_final_contest"))
  private CodeBattleContest contest;

  @ManyToOne
  @JoinColumn(name = "submission_id", foreignKey = @ForeignKey(name = "fk_final_submission"))
  private CodeBattleSubmission submission;

  @Column(nullable = false)
  private boolean isManual = false;

  @Column(nullable = false)
  private LocalDateTime updatedAt;

  @PreUpdate
  protected void onUpdate() {
    updatedAt = LocalDateTime.now();
  }

  public ContestFinalSubmission(
      Users user,
      CodeBattleContest contest,
      CodeBattleSubmission submission,
      boolean isManual) {
    this.user = user;
    this.contest = contest;
    this.submission = submission;
    this.isManual = isManual;
  }

  public void changeSubmission(CodeBattleSubmission submission) {
    this.submission = submission;
  }
}
