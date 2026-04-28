package com.asap.server.controller;

import java.net.URI;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.asap.server.domain.AlgorithmProblem;
import com.asap.server.dto.request.CreateAlgorithmProblemRequest;
import com.asap.server.dto.response.AlgorithmProblemDetailResponse;
import com.asap.server.dto.response.AlgorithmProblemListResponse;
import com.asap.server.service.ProblemService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.Parameters;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/algorithms")
public class ProblemController {

    private final ProblemService problemService;

    @PostMapping("/create")
    public ResponseEntity<AlgorithmProblemDetailResponse> createProblem(
            @RequestBody CreateAlgorithmProblemRequest request) {
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

    @GetMapping("/list")
    @Operation(summary = "문제 목록 조회", description = "page, size, sort를 함께 사용해 페이징/정렬 조회합니다.")
    @Parameters({
            @Parameter(in = ParameterIn.QUERY, name = "page", description = "페이지 번호 (0부터 시작)", schema = @Schema(type = "integer", defaultValue = "0", example = "0")),
            @Parameter(in = ParameterIn.QUERY, name = "size", description = "페이지 크기", schema = @Schema(type = "integer", defaultValue = "20", example = "20")),
            @Parameter(in = ParameterIn.QUERY, name = "sort", description = "정렬 기준 (사용법: 컬럼명,asc|desc)", array = @ArraySchema(schema = @Schema(type = "string", example = "id,desc")))
    })
    public ResponseEntity<Page<AlgorithmProblemListResponse>> getProblemList(
            // 디폴트 페이지 설정
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.DESC) Pageable pageable) {

        // Service에 페이징 정보를 넘겨서 DTO 변환된 결과를 받아옵니다.
        Page<AlgorithmProblemListResponse> responses = problemService.getProblemPage(pageable);
        return ResponseEntity.ok(responses);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AlgorithmProblemDetailResponse> getProblemDetail(@PathVariable("id") Long id) {
        // Service를 통해 ID로 문제 엔티티 조회
        AlgorithmProblem problem = problemService.getProblemById(id);

        // 엔티티를 상세 정보 DTO로 변환
        AlgorithmProblemDetailResponse responseData = AlgorithmProblemDetailResponse.from(problem);

        // 200 OK와 함께 데이터 반환
        return ResponseEntity.ok(responseData);
    }
}