package com.asap.server.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
public class S3Config {

  @Value("${cloud.aws.region}")
  private String region;

  // 로컬 테스트용: application.properties 또는 환경변수로 설정 가능
  // 미설정(빈 문자열)이면 IAM Role / DefaultCredentialsProvider 사용
  @Value("${cloud.aws.credentials.access-key:}")
  private String accessKeyId;

  @Value("${cloud.aws.credentials.secret-key:}")
  private String secretAccessKey;

  private AwsCredentialsProvider credentialsProvider() {
    if (accessKeyId != null && !accessKeyId.isBlank()
        && secretAccessKey != null && !secretAccessKey.isBlank()) {
      return StaticCredentialsProvider.create(
          AwsBasicCredentials.create(accessKeyId, secretAccessKey));
    }
    return DefaultCredentialsProvider.create();
  }

  @Bean
  public S3Client s3Client() {
    return S3Client.builder()
        .region(Region.of(region))
        .credentialsProvider(credentialsProvider())
        .build();
  }

  @Bean
  public S3Presigner s3Presigner() {
    return S3Presigner.builder()
        .region(Region.of(region))
        .credentialsProvider(credentialsProvider())
        .build();
  }
}