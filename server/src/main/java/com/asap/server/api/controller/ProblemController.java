package com.asap.server.api.controller;

import java.net.URI;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.asap.server.api.dto.request.CreateAlgorithmProblemRequest;
import com.asap.server.api.dto.response.AlgorithmProblemDetailResponse;
import com.asap.server.api.service.ProblemService;
import com.asap.server.domain.AlgorithmProblem;

import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/algorithms")
public class ProblemController {

    private final ProblemService problemService;

    @PostMapping("/create")
    public ResponseEntity<AlgorithmProblemDetailResponse> createProblem(@RequestBody CreateAlgorithmProblemRequest request) {
        // 엔티티 변환 및 서비스 호출을 통해 저장 (저장된 엔티티 반환)
        AlgorithmProblem savedProblem = problemService.createProblem(request.toEntity());

        // 히든 케이스가 제외된 상세 정보 DTO 생성
        AlgorithmProblemDetailResponse responseData = AlgorithmProblemDetailResponse.from(savedProblem);

        // ApiResponse 래퍼 없이 responseData만 body에 담아 반환
        // HTTP 상태 코드 201(Created)와 함께 데이터가 전송됩니다.
        return ResponseEntity
                .created(URI.create("/api/algorithms/" + savedProblem.getId()))
                .body(responseData);
    }
}