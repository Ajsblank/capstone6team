package com.asap.server.api.entity;

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
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor
public class Contest {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(length = 50)
  private String title;

  @Column
  private String description_url;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private ContestStatus status;

  @Column
  private Boolean certification; // True for certification contest

  @Column
  private String judge_code_url;

  @Column
  private String example_code_url;

  @Column(nullable = false)
  private LocalDateTime created_at;

  @Column
  private LocalDateTime updated_at;

  @Column
  private LocalDateTime deleted_at;

  public Contest(String title, String description_url, ContestStatus status, Boolean certification,
      String judge_code_url, String example_code_url) {
    this.title = title;
    this.description_url = description_url;
    this.status = status;
    this.certification = certification;
    this.judge_code_url = judge_code_url;
    this.example_code_url = example_code_url;
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
    TEST, RUNNING, END, PLANNED
  }
}
