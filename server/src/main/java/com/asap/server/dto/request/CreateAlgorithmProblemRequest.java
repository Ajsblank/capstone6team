package com.asap.server.dto.request;

import java.util.List;
import java.util.stream.Collectors;

import com.asap.server.domain.AlgorithmProblem; // 엔티티 경로

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
public class CreateAlgorithmProblemRequest {

    private String title;
    private String description;
    private String input_description;
    private String output_description;

    private int memory_limit_mb;
    private int time_limit_sec;

    private List<VisibleTestCaseDto> example_testcases;
    private List<VisibleTestCaseDto> hidden_testcases;

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VisibleTestCaseDto {
        private String input;
        private String output;

        // DTO 내부의 테스트케이스를 엔티티 내부의 TestCase 객체로 변환
        public AlgorithmProblem.TestCase toEntity() {
            return new AlgorithmProblem.TestCase(this.input, this.output);
        }
    }

    // 이 DTO를 전체 엔티티 객체로 변환하는 메서드
    public AlgorithmProblem toEntity() {
        return AlgorithmProblem.builder()
                .title(this.title)
                .description(this.description)
                .input_description(this.input_description)
                .output_description(this.output_description)
                .memory_limit_mb(this.memory_limit_mb)
                .time_limit_sec(this.time_limit_sec)
                .example_testcases(this.example_testcases.stream()
                        .map(VisibleTestCaseDto::toEntity)
                        .collect(Collectors.toList()))
                .hidden_testcases(this.hidden_testcases.stream()
                        .map(VisibleTestCaseDto::toEntity)
                        .collect(Collectors.toList()))
                .build();
    }
}