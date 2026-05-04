package com.asap.server.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.solapi.sdk.SolapiClient;
import com.solapi.sdk.message.service.DefaultMessageService;

@Configuration
public class SolapiConfig {

  @Value("${solapi.api-key}")
  private String apiKey;

  @Value("${solapi.api-secret}")
  private String apiSecret;

  @Bean
  public DefaultMessageService defaultMessageService() {
    // 기존에 사용하시던 방식 그대로 인스턴스를 생성하여 Bean으로 등록합니다.
    return SolapiClient.INSTANCE.createInstance(apiKey, apiSecret);
  }
}
