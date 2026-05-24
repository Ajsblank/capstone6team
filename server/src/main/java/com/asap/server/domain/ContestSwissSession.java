package com.asap.server.domain;

import java.time.LocalDateTime;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.asap.server.global.type.ContestStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PreUpdate;
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
  // 새로 생성
  @Column(name = "scheduled_at", nullable = false)
  private LocalDateTime scheduledAt;
  // 새로 생성
  @JdbcTypeCode(SqlTypes.NAMED_ENUM)
  @Enumerated(EnumType.STRING)
  @Column(nullable = false, name = "status", columnDefinition = "status")
  ContestStatus status = ContestStatus.PLANNED;
  @Column(name = "session_number")
  private Integer sessionNumber;
  @Column(name = "started_at")
  private LocalDateTime startedAt;
  @Column(name = "finished_at")
  private LocalDateTime finishedAt;
  // 새로 생성
  @Column(name = "updated_at", nullable = false, updatable = true)
  private LocalDateTime updatedAt = LocalDateTime.now();

  @PreUpdate
  protected void onUpdate() {
    updatedAt = LocalDateTime.now();
  }
}