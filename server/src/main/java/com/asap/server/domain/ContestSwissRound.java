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

@Entity
@Table(name = "contest_swiss_round")
@Getter
@Setter
@NoArgsConstructor
public class ContestSwissRound {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "session_id")
  private ContestSwissSession session;
  @Column(name = "round_number")
  private Integer roundNumber;

  @Column(name = "status")
  private String status = "PLANNED";
  @Column(name = "started_at")
  private LocalDateTime startedAt;
  @Column(name = "finished_at")
  private LocalDateTime finishedAt;
}