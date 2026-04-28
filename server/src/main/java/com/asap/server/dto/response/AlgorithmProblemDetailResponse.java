package com.asap.server.dto.response;

import java.util.List;

import com.asap.server.domain.AlgorithmProblem;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class AlgorithmProblemDetailResponse {
    private Long id;
    private String title;
    private String description;
    private String input_description;
    private String output_description;
    private int memory_limit_mb;
    private int time_limit_sec;
    private List<AlgorithmProblem.TestCase> example_testcases;

    // 엔티티를 DTO로 변환하는 정적 메서드
    public static AlgorithmProblemDetailResponse from(AlgorithmProblem problem) {
        return AlgorithmProblemDetailResponse.builder()
                .id(problem.getId())
                .title(problem.getTitle())
                .description(problem.getDescription())
                .input_description(problem.getInput_description())
                .output_description(problem.getOutput_description())
                .memory_limit_mb(problem.getMemory_limit_mb())
                .time_limit_sec(problem.getTime_limit_sec())
                .example_testcases(problem.getExample_testcases())
                .build();
    }
}