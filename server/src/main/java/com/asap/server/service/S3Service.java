package com.asap.server.service;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

@Slf4j
@Service
@RequiredArgsConstructor
public class S3Service {

  private final S3Client s3Client;
  private final S3Presigner s3Presigner;

  @Value("${cloud.aws.s3.bucket}")
  private String bucket;

  @Value("${cloud.aws.region}")
  private String region;

  @Value("${cloud.aws.s3.presigned-expiry-minutes}")
  private int expiryMinutes;

  @Value("${cloud.aws.s3.public-base-url:}")
  private String publicBaseUrl;

  @Value("${cloud.aws.s3.contest-html-prefix:backend-deploy/contest-resource}")
  private String contestHtmlPrefix;

  @Value("${cloud.aws.s3.contest-code-prefix:backend-deploy/contest-resource}")
  private String contestCodePrefix;

  /**
   * S3 객체를 문자열(UTF-8)로 읽는다.
   * 입력은 S3 key 또는 public URL 모두 허용한다.
   */
  public String readFileAsString(String keyOrUrl) {
    if (keyOrUrl == null || keyOrUrl.isBlank()) {
      throw new IllegalArgumentException("S3 key/url이 비어 있습니다.");
    }
    String key = keyOrUrl;

    if (keyOrUrl.startsWith("http")) {
      // "https://bucket.s3.region.amazonaws.com/key/path" → "key/path"
      // "http://bucket.s3-website-region.amazonaws.com/key/path" → "key/path"
      URI uri = URI.create(keyOrUrl);
      key = uri.getPath().replaceFirst("^/", ""); // 앞 슬래시 제거
    }

    GetObjectRequest request = GetObjectRequest.builder()
        .bucket(bucket)
        .key(key)
        .build();

    try (ResponseInputStream<GetObjectResponse> response = s3Client.getObject(request)) {
      return new String(response.readAllBytes(), StandardCharsets.UTF_8);
    } catch (IOException e) {
      throw new IllegalStateException("S3 파일 읽기 실패 - key: " + key, e);
    }
  }

  /**
   * 기존 파일의 Pre-signed URL 재발급
   */
  public String generatePresignedUrl(String key) {
    GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
        .signatureDuration(Duration.ofMinutes(expiryMinutes))
        .getObjectRequest(r -> r.bucket(bucket).key(key))
        .build();

    String url = s3Presigner.presignGetObject(presignRequest).url().toString();
    log.info("Pre-signed URL 발급 - key: {}, 유효시간: {}분", key, expiryMinutes);

    return url;
  }

  private String normalizeContestCodePrefix() {
    String prefix = contestCodePrefix;
    if (prefix.startsWith("/")) {
      prefix = prefix.substring(1);
    }
    if (prefix.endsWith("/")) {
      prefix = prefix.substring(0, prefix.length() - 1);
    }
    return prefix;
  }

  public void uploadJsonResult(String key, String json) {
    PutObjectRequest putRequest = PutObjectRequest.builder()
        .bucket(bucket)
        .key(key)
        .contentType("application/json; charset=UTF-8")
        .build();

    s3Client.putObject(putRequest,
        RequestBody.fromBytes(json.getBytes(StandardCharsets.UTF_8)));
    log.info("JSON 결과 업로드 완료 - key: {}", key);
  }

  public String buildFinalResultKey(Long contestId) {
    return String.format("%s/%d/final-result", normalizeContestCodePrefix(), contestId);
  }

  public String buildSessionResultKey(Long contestId, int sessionNumber) {
    return String.format("%s/%d/swiss-result/session-%d", normalizeContestCodePrefix(), contestId, sessionNumber);
  }
}