package com.asap.server.api.controller;

import com.asap.server.api.dto.request.CodeSubmitRequest;
import com.asap.server.api.dto.response.CodeSubmitResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/code")
public class CodeController {
    
    @PostMapping("/submit")
    public ResponseEntity<CodeSubmitResponse> submitCode(@RequestBody CodeSubmitRequest request) {
        
        CodeSubmitResponse responseData = new CodeSubmitResponse(true, "코드가 서버에 성공적으로 제출되었습니다!");
        
        return ResponseEntity.ok(responseData);
    }
}
