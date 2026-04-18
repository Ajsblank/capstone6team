package com.asap.server.api.dto.response;

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
    private String inputDescription;
    private String outputDescription;
    private int memoryLimitMB;
    private int timeLimitSec;
    private List<AlgorithmProblem.TestCase> exampleTestcases;

    // 엔티티를 DTO로 변환하는 정적 메서드
    public static AlgorithmProblemDetailResponse from(AlgorithmProblem problem) {
        return AlgorithmProblemDetailResponse.builder()
                .id(problem.getId())
                .title(problem.getTitle())
                .description(problem.getDescription())
                .inputDescription(problem.getInputDescription())
                .outputDescription(problem.getOutputDescription())
                .memoryLimitMB(problem.getMemoryLimitMB())
                .timeLimitSec(problem.getTimeLimitSec())
                .exampleTestcases(problem.getExampleTestcases())
                .build();
    }
}