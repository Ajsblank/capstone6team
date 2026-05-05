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
  private int timeLimitSec;

  @Column(name = "memory_limit_mb")
  private int memoryLimitMB;

  @Column(name = "visualization_html_url")
  private String visualizationHtml;
  
  @Column(name = "solo_play_html_url")
  private String soloPlayHtml;

  // PostgreSQL enum(status)와 Java enum 간 바인딩 타입을 명시한다.
  @JdbcTypeCode(SqlTypes.NAMED_ENUM)
  @Enumerated(EnumType.STRING)
  @Column(nullable = false, name = "status", columnDefinition = "status")
  private ContestStatus status;

  @Column
  private Boolean certification; // True for certification contest

  @Column(columnDefinition = "TEXT", name = "judge_code")
  private String judgeCode;

  @Column(columnDefinition = "TEXT", name = "example_code")
  private String exampleCode;

  @Column(name = "max_participants")
  private int maxParticipants;

  @Column(name = "start_date")
  private LocalDateTime startDate;

  @Column(name = "end_date")
  private LocalDateTime endDate;

  @Column(nullable = false, name = "created_at")
  private LocalDateTime createdAt;

  @Column(name = "deleted_at")
  private LocalDateTime deletedAt;

  public static CodeBattleContest create(String title, String description, ContestStatus status, Boolean certification,
      Integer timeLimitSec, Integer memoryLimitMB, String judgeCode, String exampleCode,
      Integer maxParticipants, LocalDateTime startDate, LocalDateTime endDate, 
      String visualizationHtml,String soloPlayHtml) {
    CodeBattleContest contest = new CodeBattleContest();
    contest.title = title;
    contest.description = description;
    contest.status = status;
    contest.certification = certification;
    contest.timeLimitSec = timeLimitSec;
    contest.memoryLimitMB = memoryLimitMB;
    contest.judgeCode = judgeCode;
    contest.exampleCode = exampleCode;
    contest.maxParticipants = maxParticipants;
    contest.startDate = startDate;
    contest.endDate = endDate;
    contest.visualizationHtml=visualizationHtml;
    contest.soloPlayHtml=soloPlayHtml;
    return contest;
  }

  public void updateStatusAndSchedule(ContestStatus status, LocalDateTime startDate, LocalDateTime endDate) {
    this.status = status;
    this.startDate = startDate;
    this.endDate = endDate;
  }

  public void updateContestFields(
      String title,
      String description,
      Boolean certification,
      Integer timeLimitSec,
      Integer memoryLimitMB,
      String judgeCode,
      String exampleCode,
      Integer maxParticipants) {
    if (title != null) {
      this.title = title;
    }
    if (description != null) {
      this.description = description;
    }
    if (certification != null) {
      this.certification = certification;
    }
    if (timeLimitSec != null) {
      this.timeLimitSec = timeLimitSec;
    }
    if (memoryLimitMB != null) {
      this.memoryLimitMB = memoryLimitMB;
    }
    if (judgeCode != null) {
      this.judgeCode = judgeCode;
    }
    if (exampleCode != null) {
      this.exampleCode = exampleCode;
    }
    if (maxParticipants != null) {
      this.maxParticipants = maxParticipants;
    }
  }

  @PrePersist
  protected void onCreate() {
    createdAt = LocalDateTime.now();
  }

  public enum ContestStatus {
    TEST, RUNNING, END, PLANNED, PAUSED
  }
}
