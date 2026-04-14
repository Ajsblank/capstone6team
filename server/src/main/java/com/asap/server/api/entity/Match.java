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
public class Match {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne
  @JoinColumn(name = "contest_id", foreignKey = @ForeignKey(name = "fk_match_contest"))
  private Contest contest;

  @ManyToOne
  @JoinColumn(name = "user1_id", foreignKey = @ForeignKey(name = "fk_match_user1"))
  private User user1;

  @ManyToOne
  @JoinColumn(name = "user2_id", foreignKey = @ForeignKey(name = "fk_match_user2"))
  private User user2;

  @ManyToOne
  @JoinColumn(name = "winner_id", foreignKey = @ForeignKey(name = "fk_match_winner"))
  private User winner;

  @Column(columnDefinition = "TEXT")
  private String log;

  @Column(nullable = false)
  private LocalDateTime created_at;

  public Match(Contest contest, User user1, User user2, User winner, String log) {
    this.contest = contest;
    this.user1 = user1;
    this.user2 = user2;
    this.winner = winner;
    this.log = log;
  }

  @PrePersist
  protected void onCreate() {
    created_at = LocalDateTime.now();
  }
}
