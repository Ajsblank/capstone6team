package com.asap.server.service;

import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class MailService {

  private final JavaMailSender javaMailSender;
  private static final String senderEmail = "ajs8780@ajou.ac.kr";

  // 이메일 -> 인증번호 임시 저장 (인증 성공 시 제거)
  private final Map<String, String> codeStore = new ConcurrentHashMap<>();

  private String createNumber() {
    return String.format("%06d", new Random().nextInt(1000000));
  }

  private MimeMessage createMail(String mail, String code) {
    MimeMessage message = javaMailSender.createMimeMessage();
    try {
      message.setFrom(senderEmail);
      message.setRecipients(MimeMessage.RecipientType.TO, mail);
      message.setSubject("[CodeBattle] 이메일 인증번호");
      String body = "<h3>요청하신 인증 번호입니다.</h3>"
          + "<h1>" + code + "</h1>"
          + "<h3>5분 내에 입력해주세요.</h3>";
      message.setText(body, "UTF-8", "html");
    } catch (MessagingException e) {
      log.error("메일 생성 중 오류 발생: {}", e.getMessage());
      throw new RuntimeException("메일 생성에 실패했습니다.");
    }
    return message;
  }

  // 인증번호 발송 및 서버 저장
  public void sendVerificationCode(String email) {
    String code = createNumber();
    codeStore.put(email, code);
    MimeMessage message = createMail(email, code);
    javaMailSender.send(message);
    log.info("인증번호 발송 완료 - 이메일: {}", email);
  }

  // 인증번호 검증
  public boolean verifyCode(String email, String code) {
    String stored = codeStore.get(email);
    if (stored != null && stored.equals(code)) {
      codeStore.remove(email);
      log.info("이메일 인증 성공 - 이메일: {}", email);
      return true;
    }
    log.warn("이메일 인증 실패 - 이메일: {}", email);
    return false;
  }
}