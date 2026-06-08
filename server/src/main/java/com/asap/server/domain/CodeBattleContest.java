package com.asap.server.domain;

import java.time.LocalDateTime;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.asap.server.global.type.ContestStatus;
import com.asap.server.global.type.Language;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "code_battle_contest")
@Getter
@Setter
@NoArgsConstructor
public class CodeBattleContest {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(length = 255, nullable = false)
  private String title;

  @Column(columnDefinition = "TEXT", nullable = false)
  private String description;

  @Column(name = "time_limit_sec", nullable = false)
  private int timeLimitSec;

  @Column(name = "memory_limit_mb", nullable = false)
  private int memoryLimitMB;

  @Column(name = "visualization_html_url", columnDefinition = "TEXT")
  private String visualizationHtml;

  @Column(name = "solo_play_html_url", columnDefinition = "TEXT")
  private String soloPlayHtml;

  // PostgreSQL enum(status)와 Java enum 간 바인딩 타입을 명시한다.
  @JdbcTypeCode(SqlTypes.NAMED_ENUM)
  @Enumerated(EnumType.STRING)
  @Column(nullable = false, name = "status", columnDefinition = "status")
  private ContestStatus status;

  @Column(nullable = false)
  private Boolean certification; // True for certification contest

  @Column(columnDefinition = "TEXT", name = "judge_code")
  private String judgeCode;

  @Column(columnDefinition = "TEXT", name = "sample_code")
  private String sampleCode;

  @JdbcTypeCode(SqlTypes.NAMED_ENUM)
  @Enumerated(EnumType.STRING)
  @Column(name = "judge_language", columnDefinition = "language", nullable = false)
  private Language judgeLanguage = Language.CPP;

  @Column(name = "max_participants", nullable = false)
  private int maxParticipants;

  @Column(name = "start_date")
  private LocalDateTime startDate;

  @Column(name = "end_date")
  private LocalDateTime endDate;

  @Column(nullable = false, name = "created_at")
  private LocalDateTime createdAt;

  @Column(nullable = false, name = "updated_at")
  private LocalDateTime updatedAt;

  @Column(name = "deleted_at")
  private LocalDateTime deletedAt;

  @ManyToOne
  @JoinColumn(name = "creator_id", foreignKey = @ForeignKey(name = "fk_contest_user"))
  private Users creator;

  public static CodeBattleContest create(String title, String description, ContestStatus status, Boolean certification,
      Integer timeLimitSec, Integer memoryLimitMB, String judgeCode,
      Integer maxParticipants, LocalDateTime startDate, LocalDateTime endDate,
      String visualizationHtml, String soloPlayHtml, Users creator) {
    CodeBattleContest contest = new CodeBattleContest();
    contest.title = title;
    contest.description = description;
    contest.status = status;
    contest.certification = certification;
    contest.timeLimitSec = timeLimitSec;
    contest.memoryLimitMB = memoryLimitMB;
    contest.judgeCode = judgeCode;
    contest.maxParticipants = maxParticipants;
    contest.startDate = startDate;
    contest.endDate = endDate;
    contest.visualizationHtml = visualizationHtml;
    contest.soloPlayHtml = soloPlayHtml;
    contest.creator = creator;
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
      Integer timeLimitSec,
      Integer memoryLimitMB,
      String judgeCode,
      String sampleCode,
      Integer maxParticipants) {
    if (title != null) {
      this.title = title;
    }
    if (description != null) {
      this.description = description;
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
    if (sampleCode != null) {
      this.sampleCode = sampleCode;
    }
    if (maxParticipants != null) {
      this.maxParticipants = maxParticipants;
    }
  }

  @PrePersist
  protected void onCreate() {
    createdAt = LocalDateTime.now();
    updatedAt = createdAt;
  }

  @PreUpdate
  protected void onUpdate() {
    updatedAt = LocalDateTime.now();
  }

}
