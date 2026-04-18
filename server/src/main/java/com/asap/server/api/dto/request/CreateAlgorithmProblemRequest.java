package com.asap.server.api.dto.request;

import com.asap.server.domain.AlgorithmProblem; // 엔티티 경로
import java.util.List;
import java.util.stream.Collectors;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
public class CreateAlgorithmProblemRequest {
    
    private String title;
    private String description;
    private String inputDescription;
    private String outputDescription;

    private int memoryLimitMB;
    private int timeLimitSec;

    private List<VisibleTestCaseDto> exampleTestcases;
    private List<VisibleTestCaseDto> hiddenTestcases;

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
                .inputDescription(this.inputDescription)
                .outputDescription(this.outputDescription)
                .memoryLimitMB(this.memoryLimitMB)
                .timeLimitSec(this.timeLimitSec)
                .exampleTestcases(this.exampleTestcases.stream()
                        .map(VisibleTestCaseDto::toEntity)
                        .collect(Collectors.toList()))
                .hiddenTestcases(this.hiddenTestcases.stream()
                        .map(VisibleTestCaseDto::toEntity)
                        .collect(Collectors.toList()))
                .build();
    }
}