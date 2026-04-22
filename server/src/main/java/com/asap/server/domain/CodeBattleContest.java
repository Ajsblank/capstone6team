package com.asap.server.domain;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "code_battle_contest")
@Getter
@NoArgsConstructor
public class CodeBattleContest {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(length = 255)
  private String title;

  @Column(name = "time_limit_sec")
  private int timeLimitSec;

  @Column(name = "memory_limit_mb")
  private int memoryLimitMB;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private ContestStatus status;

  @Column
  private Boolean certification; // True for certification contest

  @Column(columnDefinition = "TEXT")
  private String judge_code;

  @Column(columnDefinition = "TEXT")
  private String example_code;

  @Column(name = "max_participants")
  private int maxParticipants;

  @Column(name = "start_date")
  private LocalDateTime startDate;

  @Column(name = "end_date")
  private LocalDateTime endDate;

  @Column(nullable = false)
  private LocalDateTime created_at;

  @Column(nullable = false)
  private LocalDateTime updated_at;

  @Column
  private LocalDateTime deleted_at;

  public CodeBattleContest(String title, ContestStatus status, Boolean certification,
      String judge_code, String example_code) {
    this.title = title;
    this.status = status;
    this.certification = certification;
    this.judge_code = judge_code;
    this.example_code = example_code;
  }

  @PrePersist
  protected void onCreate() {
    created_at = LocalDateTime.now();
    updated_at = LocalDateTime.now();
  }

  @PreUpdate
  protected void onUpdate() {
    updated_at = LocalDateTime.now();
  }

  public enum ContestStatus {
    TEST, RUNNING, END, PLANNED, PAUSED
  }
}
