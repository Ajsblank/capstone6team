package com.asap.server.service;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;

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

@Slf4j
@Service
@RequiredArgsConstructor
public class S3Service {

  private final S3Client s3Client;

  @Value("${cloud.aws.s3.bucket}")
  private String bucket;

  // 안쓰고 있음 추후 삭제 고려
  @Value("${cloud.aws.cloudfront.url}")
  private String cloudFront;

  @Value("${cloud.aws.region}")
  private String region;

  @Value("${cloud.aws.s3.contest-code-prefix}")
  private String contestResourcePrefix;

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

  private String normalizePathPrefix(String pathPrefix) {
    String prefix = pathPrefix;
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

  public void uploadCode(String key, String content) {
    PutObjectRequest putRequest = PutObjectRequest.builder()
        .bucket(bucket)
        .key(key)
        .contentType("text/plain; charset=UTF-8")
        .build();

    s3Client.putObject(putRequest,
        RequestBody.fromBytes(content.getBytes(StandardCharsets.UTF_8)));
    log.info("코드 업로드 완료 - key: {}", key);
  }

  public String buildFinalResultKey(Long contestId) {
    return String.format("%s/%d/final-result", normalizePathPrefix(contestResourcePrefix), contestId);
  }

  public String buildSessionResultKey(Long contestId, int sessionNumber) {
    return String.format("%s/%d/swiss-result/session-%d", normalizePathPrefix(contestResourcePrefix), contestId,
        sessionNumber);
  }

  public String buildCodeSubmissionKey(Long contestId, Long userId, Long submissionId) {
    return String.format("%s/%d/participant-code/user-%d/code-%d", normalizePathPrefix(contestResourcePrefix),
        contestId,
        userId, submissionId);
  }
}