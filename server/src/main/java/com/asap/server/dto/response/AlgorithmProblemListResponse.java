package com.asap.server.dto.response;

import com.asap.server.domain.AlgorithmProblem;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class AlgorithmProblemListResponse {
    private Long id;
    private String title;

    // Entity를 DTO로 변환해주는 정적 팩토리 메서드입니다.
    public static AlgorithmProblemListResponse from(AlgorithmProblem problem) {
        return AlgorithmProblemListResponse.builder()
                .id(problem.getId())
                .title(problem.getTitle())
                .build();
    }
}