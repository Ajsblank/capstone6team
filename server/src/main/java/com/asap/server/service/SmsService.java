package com.asap.server.service;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Collections;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import com.asap.server.dto.request.SmsCodeVerifyRequest;
import com.asap.server.dto.request.SmsVerifyRequest;
import com.solapi.sdk.message.exception.SolapiMessageNotReceivedException;
import com.solapi.sdk.message.model.Message;
import com.solapi.sdk.message.service.DefaultMessageService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class SmsService {
  private final DefaultMessageService messageService;

  private static final SecureRandom SMS_RANDOM = new SecureRandom();

  private static final Duration SMS_CODE_TTL = Duration.ofMinutes(5);
  private static final Duration SMS_VERIFIED_TTL = Duration.ofMinutes(5);
  private static final Duration SMS_SEND_COUNT_TTL = Duration.ofMinutes(10);
  private static final Duration SMS_TRY_COUNT_TTL = Duration.ofMinutes(5);

  private static final int SMS_MAX_SEND_COUNT = 5;
  private static final int SMS_MAX_TRY_COUNT = 5;

  private static final String SMS_CODE_SUFFIX = ":sms:code";
  private static final String SMS_VERIFIED_SUFFIX = ":sms:verified";
  private static final String SMS_SEND_COUNT_SUFFIX = ":sms:send_count";
  private static final String SMS_TRY_COUNT_SUFFIX = ":sms:try_count";

  private final StringRedisTemplate redisTemplate;

  @Value("${solapi.api-key}")
  private String apiKey;

  @Value("${solapi.api-secret}")
  private String apiSecret;

  @Value("${solapi.from-number}")
  private String fromNumber;

  public void sendSMS(SmsVerifyRequest request) {
    String normalizedPhoneNumber = normalizePhoneNumber(request.getPhoneNumber());
    String sendCountKey = smsSendCountKey(normalizedPhoneNumber);
    long sendCount = incrementWithTtl(sendCountKey, SMS_SEND_COUNT_TTL);
    if (sendCount > SMS_MAX_SEND_COUNT) {
      throw new IllegalArgumentException("SMS 인증번호 재발송 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.");
    }

    String code = createSmsCode();
    redisTemplate.opsForValue().set(smsCodeKey(normalizedPhoneNumber), code, SMS_CODE_TTL);
    redisTemplate.delete(smsVerifiedKey(normalizedPhoneNumber));
    redisTemplate.delete(smsTryCountKey(normalizedPhoneNumber));

    Message message = new Message();
    message.setFrom(fromNumber); // 발신번호
    message.setTo(normalizedPhoneNumber);
    message.setText("[코드 배틀 플랫폼] 인증번호\n[" + code + "]");
    try {
      messageService.send(message);
      log.info("SMS 인증번호 발송 완료 - 전화번호: {}, 발송횟수: {}", normalizedPhoneNumber, sendCount);
    } catch (SolapiMessageNotReceivedException exception) {
      redisTemplate.delete(smsCodeKey(normalizedPhoneNumber));
      log.error("SMS 인증번호 발송 실패 - 전화번호: {}, 사유: {}", normalizedPhoneNumber, exception.getMessage());
      throw new IllegalArgumentException("SMS 발송에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } catch (Exception exception) {
      redisTemplate.delete(smsCodeKey(normalizedPhoneNumber));
      log.error("SMS 인증번호 발송 중 알 수 없는 오류 - 전화번호: {}, 사유: {}", normalizedPhoneNumber, exception.getMessage());
      throw new IllegalArgumentException("SMS 발송에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  }

  public void verifySMS(SmsCodeVerifyRequest request) {
    String normalizedPhoneNumber = normalizePhoneNumber(request.getPhoneNumber());
    String codeKey = smsCodeKey(normalizedPhoneNumber);
    String storedCode = redisTemplate.opsForValue().get(codeKey);

    if (storedCode == null) {
      throw new IllegalArgumentException("인증번호가 없거나 만료되었습니다. 다시 요청해주세요.");
    }

    if (storedCode.equals(request.getCode())) {
      redisTemplate.delete(codeKey);
      redisTemplate.delete(smsTryCountKey(normalizedPhoneNumber));
      redisTemplate.opsForValue().set(smsVerifiedKey(normalizedPhoneNumber), "true", SMS_VERIFIED_TTL);
      log.info("SMS 인증 성공 - 전화번호: {}", normalizedPhoneNumber);
      return;
    }

    long tryCount = incrementWithTtl(smsTryCountKey(normalizedPhoneNumber), SMS_TRY_COUNT_TTL);
    if (tryCount >= SMS_MAX_TRY_COUNT) {
      redisTemplate.delete(codeKey);
      throw new IllegalArgumentException("인증 시도 횟수를 초과했습니다. 인증번호를 다시 요청해주세요.");
    }

    throw new IllegalArgumentException("인증번호가 일치하지 않습니다.");
  }

  public boolean isSmsVerified(String phoneNumber) {
    String verified = redisTemplate.opsForValue().get(smsVerifiedKey(normalizePhoneNumber(phoneNumber)));
    return "true".equals(verified);
  }

  private String createSmsCode() {
    return String.format("%06d", SMS_RANDOM.nextInt(1000000));
  }

  private String normalizePhoneNumber(String phoneNumber) {
    return phoneNumber.replaceAll("[^0-9]", "").trim();
  }

  private String smsCodeKey(String phoneNumber) {
    return phoneNumber + SMS_CODE_SUFFIX;
  }

  private String smsVerifiedKey(String phoneNumber) {
    return phoneNumber + SMS_VERIFIED_SUFFIX;
  }

  private String smsSendCountKey(String phoneNumber) {
    return phoneNumber + SMS_SEND_COUNT_SUFFIX;
  }

  private String smsTryCountKey(String phoneNumber) {
    return phoneNumber + SMS_TRY_COUNT_SUFFIX;
  }

  private long incrementWithTtl(String key, Duration ttl) {
    // INCR 후 결과가 1이면 EXPIRE 설정 (이 모든 과정이 Redis 안에서 한 번에 실행됨)
    String script = "local count = redis.call('INCR', KEYS[1]); " +
        "if count == 1 then " +
        "  redis.call('EXPIRE', KEYS[1], ARGV[1]); " +
        "end; " +
        "return count;";

    Long value = redisTemplate.execute(
        new DefaultRedisScript<>(script, Long.class),
        Collections.singletonList(key),
        String.valueOf(ttl.toSeconds()));

    if (value == null) {
      throw new IllegalStateException("인증 상태 저장에 실패했습니다.");
    }
    return value;
  }
}
