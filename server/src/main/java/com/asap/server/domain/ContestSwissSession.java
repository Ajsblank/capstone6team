package com.asap.server.domain;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// ContestSwissSession.java
@Entity
@Table(name = "contest_swiss_session")
@Getter
@Setter
@NoArgsConstructor
public class ContestSwissSession {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "contest_id")
  private CodeBattleContest contest;
  @Column(name = "session_number")
  private Integer sessionNumber;
  @Column(name = "started_at")
  private LocalDateTime startedAt;
  @Column(name = "finished_at")
  private LocalDateTime finishedAt;
}