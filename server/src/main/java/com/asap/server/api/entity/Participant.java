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
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor
@Table(uniqueConstraints = {
    @UniqueConstraint(name = "uk_participant_user_contest", columnNames = { "user_id", "contest_id" })
})
public class Participant {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne
  @JoinColumn(name = "user_id", foreignKey = @ForeignKey(name = "fk_participant_user"))
  private User user;

  @ManyToOne
  @JoinColumn(name = "contest_id", foreignKey = @ForeignKey(name = "fk_participant_contest"))
  private Contest contest;

  @Column
  private Integer score;

  @ManyToOne
  @JoinColumn(name = "submission_id", foreignKey = @ForeignKey(name = "fk_participant_submission"))
  private Submission submission;

  @Column(nullable = false)
  private LocalDateTime created_at;

  public Participant(User user, Contest contest, Integer score, Submission submission) {
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
