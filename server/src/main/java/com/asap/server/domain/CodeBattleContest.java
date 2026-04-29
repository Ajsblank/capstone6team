package com.asap.server.domain;

import java.time.LocalDateTime;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
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

  @Column(length = 1000)
  private String description;

  @Column(name = "time_limit_sec")
  private int time_limit_sec;

  @Column(name = "memory_limit_mb")
  private int memory_limit_mb;

  // PostgreSQL enum(status)와 Java enum 간 바인딩 타입을 명시한다.
  @JdbcTypeCode(SqlTypes.NAMED_ENUM)
  @Enumerated(EnumType.STRING)
  @Column(nullable = false, name = "status", columnDefinition = "status")
  private ContestStatus status;

  @Column
  private Boolean certification; // True for certification contest

  @Column(columnDefinition = "TEXT")
  private String judge_code;

  @Column(columnDefinition = "TEXT")
  private String example_code;

  @Column(name = "max_participants")
  private int max_participants;

  @Column(length = 255)
  private String visualization_html_url;
  @Column(length = 255)
  private String solo_play_html_url;

  @Column(name = "start_date")
  private LocalDateTime start_date;

  @Column(name = "end_date")
  private LocalDateTime end_date;

  @Column(nullable = false)
  private LocalDateTime created_at;

  @Column
  private LocalDateTime deleted_at;

  public static CodeBattleContest create(String title, String description, ContestStatus status, Boolean certification,
      Integer time_limit_sec, Integer memory_limit_mb, String judge_code, String example_code,
      Integer max_participants, LocalDateTime start_date, LocalDateTime end_date) {
    CodeBattleContest contest = new CodeBattleContest();
    contest.title = title;
    contest.description = description;
    contest.status = status;
    contest.certification = certification;
    contest.time_limit_sec = time_limit_sec;
    contest.memory_limit_mb = memory_limit_mb;
    contest.judge_code = judge_code;
    contest.example_code = example_code;
    contest.max_participants = max_participants;
    contest.start_date = start_date;
    contest.end_date = end_date;
    return contest;
  }

  public void updateStatusAndSchedule(ContestStatus status, LocalDateTime start_date, LocalDateTime end_date) {
    this.status = status;
    this.start_date = start_date;
    this.end_date = end_date;
  }

  public void updateContestFields(
      String title,
      String description,
      Boolean certification,
      Integer time_limit_sec,
      Integer memory_limit_mb,
      String judge_code,
      String example_code,
      Integer max_participants) {
    if (title != null) {
      this.title = title;
    }
    if (description != null) {
      this.description = description;
    }
    if (certification != null) {
      this.certification = certification;
    }
    if (time_limit_sec != null) {
      this.time_limit_sec = time_limit_sec;
    }
    if (memory_limit_mb != null) {
      this.memory_limit_mb = memory_limit_mb;
    }
    if (judge_code != null) {
      this.judge_code = judge_code;
    }
    if (example_code != null) {
      this.example_code = example_code;
    }
    if (max_participants != null) {
      this.max_participants = max_participants;
    }
  }

  @PrePersist
  protected void onCreate() {
    created_at = LocalDateTime.now();
  }

  public enum ContestStatus {
    TEST, RUNNING, END, PLANNED, PAUSED
  }
}
