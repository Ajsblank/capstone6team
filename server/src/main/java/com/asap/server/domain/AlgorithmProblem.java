package com.asap.server.domain;

import java.util.List;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "algorithm_problem")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class AlgorithmProblem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String description;

    @Column(columnDefinition = "TEXT")
    private String inputDescription;

    @Column(columnDefinition = "TEXT")
    private String outputDescription;

    @Column(length = 50)
    private String category;

    @Column(name = "total_submission")
    @Builder.Default
    private Integer totalSubmission = 0;

    @Column(name = "success_count")
    @Builder.Default
    private Integer successCount = 0;

    @Convert(converter = TestCaseListConverter.class)
    @Column(name = "example_testcases", columnDefinition = "TEXT")
    private List<TestCase> exampleTestcases;

    @Convert(converter = TestCaseListConverter.class)
    @Column(name = "hidden_testcases", columnDefinition = "TEXT")
    private List<TestCase> hiddenTestcases;

    @Column(name = "time_limit_sec")
    private int timeLimitSec;

    @Column(name = "memory_limit_mb")
    private int memoryLimitMb;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TestCase {
        private String input;
        private String output;
    }
}