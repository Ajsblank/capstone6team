package com.asap.server.service;

import java.util.Random;

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
  private static int number;

  public int createNumber() {
    return new Random().nextInt(900000) + 100000; // 6자리 랜덤 숫자
  }

  public MimeMessage createMail(String mail, int number) {
    MimeMessage message = javaMailSender.createMimeMessage();

    try {
      message.setFrom(senderEmail);
      message.setRecipients(MimeMessage.RecipientType.TO, mail);
      message.setSubject("이메일 인증");
      String body = "";
      body += "<h3>요청하신 인증 번호입니다.</h3>";
      body += "<h1>" + number + "</h1>";
      body += "<h3>감사합니다.</h3>";
      message.setText(body, "UTF-8", "html");
    } catch (MessagingException e) {
      log.error("메일 생성 중 오류 발생: {}", e.getMessage());
      throw new RuntimeException("메일 생성에 실패했습니다.");
    }

    return message;
  }

  public int sendMail(String mail) {
    int number = createNumber(); // 인증번호 생성
    MimeMessage message = createMail(mail, number);

    javaMailSender.send(message);

    return number; // 생성된 번호를 컨트롤러에 전달
  }
}