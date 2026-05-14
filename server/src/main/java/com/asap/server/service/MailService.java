package com.asap.server.service;

import java.security.SecureRandom;
import java.time.Duration;

import org.springframework.data.redis.core.StringRedisTemplate;
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
  private final StringRedisTemplate redisTemplate;
  private static final String senderEmail = "ajs8780@ajou.ac.kr";
  private static final SecureRandom random = new SecureRandom();

  private static final Duration CODE_TTL = Duration.ofMinutes(2);
  private static final Duration VERIFIED_TTL = Duration.ofMinutes(10);
  private static final Duration SEND_COUNT_TTL = Duration.ofMinutes(10);
  private static final Duration TRY_COUNT_TTL = Duration.ofMinutes(5);

  private static final int MAX_SEND_COUNT = 5;
  private static final int MAX_TRY_COUNT = 5;

  private static final String CODE_SUFFIX = ":code";
  private static final String VERIFIED_SUFFIX = ":verified";
  private static final String SEND_COUNT_SUFFIX = ":send_count";
  private static final String TRY_COUNT_SUFFIX = ":try_count";

  private String createNumber() {
    return String.format("%06d", random.nextInt(1000000));
  }

  private String normalizeEmail(String email) {
    return email.trim().toLowerCase();
  }

  private String codeKey(String email) {
    return normalizeEmail(email) + CODE_SUFFIX;
  }

  private String verifiedKey(String email) {
    return normalizeEmail(email) + VERIFIED_SUFFIX;
  }

  private String sendCountKey(String email) {
    return normalizeEmail(email) + SEND_COUNT_SUFFIX;
  }

  private String tryCountKey(String email) {
    return normalizeEmail(email) + TRY_COUNT_SUFFIX;
  }

  private long incrementWithTtl(String key, Duration ttl) {
    Long value = redisTemplate.opsForValue().increment(key);
    if (value == null) {
      throw new IllegalStateException("인증 상태 저장에 실패했습니다.");
    }
    if (value == 1L) {
      redisTemplate.expire(key, ttl);
    }
    return value;
  }

  private MimeMessage createMail(String mail, String code) {
    MimeMessage message = javaMailSender.createMimeMessage();
    Long minutes = CODE_TTL.toMinutes();
    try {
      message.setFrom(senderEmail);
      message.setRecipients(MimeMessage.RecipientType.TO, mail);
      message.setSubject("[CodeBattle] 이메일 인증번호");
      String body = "<h3>요청하신 인증 번호입니다.</h3>"
          + "<h1>" + code + "</h1>"
          + "<h3>" + minutes + "분 내에 입력해주세요.</h3>";
      message.setText(body, "UTF-8", "html");
    } catch (MessagingException e) {
      log.error("메일 생성 중 오류 발생: {}", e.getMessage());
      throw new RuntimeException("메일 생성에 실패했습니다.");
    }
    return message;
  }

  // 인증번호 발송 및 서버 저장
  public void sendVerificationCode(String email) {
    String normalizedEmail = normalizeEmail(email);
    String sendCountKey = sendCountKey(normalizedEmail);
    long sendCount = incrementWithTtl(sendCountKey, SEND_COUNT_TTL);
    if (sendCount > MAX_SEND_COUNT) {
      throw new IllegalArgumentException("인증번호 재발송 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.");
    }

    String code = createNumber();
    redisTemplate.opsForValue().set(codeKey(normalizedEmail), code, CODE_TTL);
    redisTemplate.delete(verifiedKey(normalizedEmail));
    redisTemplate.delete(tryCountKey(normalizedEmail));

    MimeMessage message = createMail(normalizedEmail, code);
    javaMailSender.send(message);
    log.info("인증번호 발송 완료 - 이메일: {}, 발송횟수: {}", normalizedEmail, sendCount);
  }

  // 인증번호 검증
  public boolean verifyCode(String email, String code) {
    String normalizedEmail = normalizeEmail(email);
    String codeKey = codeKey(normalizedEmail);
    String stored = redisTemplate.opsForValue().get(codeKey);

    if (stored == null) {
      log.warn("인증번호 없음 또는 만료 - 이메일: {}", normalizedEmail);
      return false;
    }

    if (stored.equals(code)) {
      redisTemplate.delete(codeKey);
      redisTemplate.opsForValue().set(verifiedKey(normalizedEmail), "true", VERIFIED_TTL);
      redisTemplate.delete(tryCountKey(normalizedEmail));
      log.info("이메일 인증 성공 - 이메일: {}", normalizedEmail);
      return true;
    }

    long tryCount = incrementWithTtl(tryCountKey(normalizedEmail), TRY_COUNT_TTL);
    if (tryCount >= MAX_TRY_COUNT) {
      redisTemplate.delete(codeKey);
      log.warn("인증 시도 횟수 초과로 코드 무효화 - 이메일: {}, 시도횟수: {}", normalizedEmail, tryCount);
      return false;
    }

    log.warn("이메일 인증 실패 - 이메일: {}, 시도횟수: {}", normalizedEmail, tryCount);
    return false;
  }

  public boolean isVerified(String email) {
    String verified = redisTemplate.opsForValue().get(verifiedKey(email));
    return "true".equals(verified);
  }
}