package com.asap.server.domain;

import java.time.LocalDateTime;

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
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "algorithm_submission")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class AlgorithmSubmission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", foreignKey = @ForeignKey(name = "fk_algorithm_submission_user"))
    private Users user;

    @ManyToOne
    @JoinColumn(name = "problem_id", foreignKey = @ForeignKey(name = "fk_algorithm_submission_problem"))
    private AlgorithmProblem problem;

    @Enumerated(EnumType.STRING)
    @Column
    private CodeLanguage language;

    @Column
    private String code;

    @Column
    private String result;

    @Column(name = "execution_time_sec")
    private int execution_time_sec;

    @Column(name = "memory_usage_mb")
    private int memory_usage_mb;

    @Column
    private LocalDateTime created_at;

    @PrePersist
    protected void onCreate() {
        created_at = LocalDateTime.now();
    }
}