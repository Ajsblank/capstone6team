package com.asap.server.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.asap.server.dto.request.EmailRequest;
import com.asap.server.service.MailService;

import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/auth/mail")
public class MailController {

  private final MailService mailService;

  @PostMapping
  public ResponseEntity<Integer> sendMail(@RequestBody EmailRequest request) {
    // JSON 바디에서 email을 꺼내서 서비스 호출
    int authNumber = mailService.sendMail(request.getEmail());

    // 결과값을 JSON 숫자로 반환
    return ResponseEntity.ok(authNumber);
  }
}