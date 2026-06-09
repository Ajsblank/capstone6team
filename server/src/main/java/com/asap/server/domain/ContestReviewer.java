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
import lombok.Setter;

/**
 * 인증 대회의 검수자 정보를 저장하는 엔티티
 * 한 대회에 여러 검수자가 있을 수 있음
 */
@Entity
@Table(name = "contest_reviewer", uniqueConstraints = {
  @UniqueConstraint(name = "uk_contest_reviewer_email", columnNames = { "contest_id", "reviewer_email" })
})
@Getter
@Setter
@NoArgsConstructor
public class ContestReviewer {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne
  @JoinColumn(name = "contest_id", nullable = false, foreignKey = @ForeignKey(name = "fk_contest_reviewer_contest"))
  private CodeBattleContest contest;

  @Column(name = "reviewer_email", nullable = false, length = 255)
  private String reviewerEmail;

  @Column(name = "created_at", nullable = false)
  private LocalDateTime createdAt;

  @PrePersist
  protected void onCreate() {
    if (createdAt == null) {
      createdAt = LocalDateTime.now();
    }
  }

  public static ContestReviewer create(CodeBattleContest contest, String reviewerEmail) {
    ContestReviewer reviewer = new ContestReviewer();
    reviewer.contest = contest;
    reviewer.reviewerEmail = reviewerEmail;
    reviewer.createdAt = LocalDateTime.now();
    return reviewer;
  }
}
