package com.asap.server.api.entity;

import java.time.LocalDateTime;

// JPA 관련 어노테이션
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity(name = "users") // "이 클래스는 DB 테이블과 매핑된다"는 선언
@Getter // Getter 메서드 자동 생성
@NoArgsConstructor // 파라미터가 없는 기본 생성자 자동 생성 (JPA 필수)
public class User {

  @Id // Primary Key
  @GeneratedValue(strategy = GenerationType.IDENTITY) // Auto Increment (PostgreSQL SERIAL)
  private Long id;

  @Column(nullable = false, unique = true)
  private String email;

  @Column(nullable = false)
  private String password;

  @Column(length = 50)
  private String affiliation;

  @Column(nullable = false)
  private LocalDateTime created_at;

  @Column(nullable = false)
  private LocalDateTime updated_at;

  @Column
  private LocalDateTime deleted_at;

  // 생성자 추가
  public User(String email, String password) {
    this.email = email;
    this.password = password;
  }

  // 타임스탬프 자동 설정
  @PrePersist
  protected void onCreate() {
    created_at = LocalDateTime.now();
    updated_at = LocalDateTime.now();
  }

  @PreUpdate
  protected void onUpdate() {
    updated_at = LocalDateTime.now();
  }
}
