package com.asap.server.service;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.asap.server.global.type.Language;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

@Slf4j
@Service
@RequiredArgsConstructor
public class S3Service {

  public record SubmissionUploadResult(String key, String url) {
  }

  public enum ContestResourceType {
    VISUAL_HTML("visual-html"),
    SOLO_HTML("solo-html");

    private final String directory;

    ContestResourceType(String directory) {
      this.directory = directory;
    }

    public String directory() {
      return directory;
    }
  }

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
   * 대회 리소스 HTML 파일 업로드 (파일명 무시, 고정 경로 사용)
   * backend-deploy/contest-resource/{contestId}/{visual-html|solo-html}/index.html
   * 재업로드 시 기존 파일 덮어쓰기
   */
  public String uploadContestResourceFile(Long contestId, ContestResourceType type, MultipartFile file)
      throws IOException {
    validateHtmlFile(file);

    String key = buildContestResourceKey(contestId, type);
    PutObjectRequest putRequest = PutObjectRequest.builder()
        .bucket(bucket)
        .key(key)
        .contentType("text/html; charset=UTF-8")
        .build();

    s3Client.putObject(putRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
    log.info("대회 리소스 업로드 완료 - contestId: {}, type: {}, key: {}", contestId, type, key);

    return buildPublicUrl(key);
  }

  public String getContestResourceUrl(Long contestId, ContestResourceType type) {
    return buildPublicUrl(buildContestResourceKey(contestId, type));
  }

  /**
   * 채점 코드 업로드
   * backend-deploy/contest-resource/{contestId}/judge-code/judge_code.cpp
   */
  public String uploadJudgeCodeContent(Long contestId, String judgeCode) {
    if (judgeCode == null || judgeCode.isBlank()) {
      throw new IllegalArgumentException("judgeCode는 비어 있을 수 없습니다.");
    }

    String key = buildJudgeCodeKey(contestId);
    PutObjectRequest putRequest = PutObjectRequest.builder()
        .bucket(bucket)
        .key(key)
        .contentType("text/x-c++src; charset=UTF-8")
        .build();

    s3Client.putObject(putRequest, RequestBody.fromBytes(judgeCode.getBytes(StandardCharsets.UTF_8)));
    log.info("채점 코드 업로드 완료 - contestId: {}, key: {}", contestId, key);

    return buildPublicUrl(key);
  }

  /**
   * 예제 코드 업로드
   * backend-deploy/contest-resource/{contestId}/example-code/{name}.cpp
   */
  public String uploadExampleCodeContent(Long contestId, String exampleCode, String exampleCodeName) {
    if (exampleCode == null || exampleCode.isBlank()) {
      throw new IllegalArgumentException("exampleCode는 비어 있을 수 없습니다.");
    }

    String key = buildExampleCodeKey(contestId, exampleCodeName);
    PutObjectRequest putRequest = PutObjectRequest.builder()
        .bucket(bucket)
        .key(key)
        .contentType("text/x-c++src; charset=UTF-8")
        .build();

    s3Client.putObject(putRequest, RequestBody.fromBytes(exampleCode.getBytes(StandardCharsets.UTF_8)));
    log.info("예제 코드 업로드 완료 - contestId: {}, key: {}", contestId, key);

    return buildPublicUrl(key);
  }

  public String uploadJudgeCodeFile(Long contestId, MultipartFile file) throws IOException {
    validateCppFile(file, "judgeCodeFile");
    String key = buildJudgeCodeKey(contestId);

    PutObjectRequest putRequest = PutObjectRequest.builder()
        .bucket(bucket)
        .key(key)
        .contentType("text/x-c++src; charset=UTF-8")
        .build();

    s3Client.putObject(putRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
    log.info("채점 코드 파일 업로드 완료 - contestId: {}, key: {}", contestId, key);

    return buildPublicUrl(key);
  }

  public String uploadExampleCodeFile(Long contestId, String exampleCodeName, MultipartFile file) throws IOException {
    validateCppFile(file, "exampleCodeFile");
    String key = buildExampleCodeKey(contestId, exampleCodeName);

    PutObjectRequest putRequest = PutObjectRequest.builder()
        .bucket(bucket)
        .key(key)
        .contentType("text/x-c++src; charset=UTF-8")
        .build();

    s3Client.putObject(putRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
    log.info("예제 코드 파일 업로드 완료 - contestId: {}, key: {}", contestId, key);

    return buildPublicUrl(key);
  }

  public void deleteContestResourceFile(Long contestId, ContestResourceType type) {
    deleteObject(buildContestResourceKey(contestId, type));
  }

  public void deleteJudgeCodeFile(Long contestId) {
    deleteObject(buildJudgeCodeKey(contestId));
  }

  public void deleteExampleCodeFile(Long contestId, String exampleCodeName) {
    deleteObject(buildExampleCodeKey(contestId, exampleCodeName));
  }

  /**
   * 코드 배틀 제출 코드 업로드
   * backend-deploy/contest-resource/{contestId}/submissions/sub_{submissionId}_{userId}.{ext}
   */
  public SubmissionUploadResult uploadContestSubmissionFile(
      Long contestId,
      Long submissionId,
      Long userId,
      Language language,
      MultipartFile file) throws IOException {
    if (file == null || file.isEmpty()) {
      throw new IllegalArgumentException("제출 파일은 필수입니다.");
    }

    String extension = extensionByLanguage(language);
    String key = buildSubmissionCodeKey(contestId, submissionId, userId, extension);

    PutObjectRequest putRequest = PutObjectRequest.builder()
        .bucket(bucket)
        .key(key)
        .contentType("text/plain; charset=UTF-8")
        .build();

    s3Client.putObject(putRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
    log.info("코드 배틀 제출 파일 업로드 완료 - contestId: {}, submissionId: {}, key: {}", contestId, submissionId, key);
    return new SubmissionUploadResult(key, buildPublicUrl(key));
  }

  public SubmissionUploadResult uploadContestSubmissionContent(
      Long contestId,
      Long submissionId,
      Long userId,
      Language language,
      String sourceCode) {
    if (sourceCode == null || sourceCode.isBlank()) {
      throw new IllegalArgumentException("sourceCode는 비어 있을 수 없습니다.");
    }

    String extension = extensionByLanguage(language);
    String key = buildSubmissionCodeKey(contestId, submissionId, userId, extension);

    PutObjectRequest putRequest = PutObjectRequest.builder()
        .bucket(bucket)
        .key(key)
        .contentType("text/plain; charset=UTF-8")
        .build();

    s3Client.putObject(putRequest, RequestBody.fromBytes(sourceCode.getBytes(StandardCharsets.UTF_8)));
    log.info("코드 배틀 제출 문자열 업로드 완료 - contestId: {}, submissionId: {}, key: {}", contestId, submissionId, key);
    return new SubmissionUploadResult(key, buildPublicUrl(key));
  }

  public void deleteObjectByKey(String key) {
    deleteObject(key);
  }

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

  // HTML 파일 여부 검증
  private void validateHtmlFile(MultipartFile file) {
    String filename = file.getOriginalFilename();
    if (filename == null || !filename.toLowerCase().endsWith(".html")) {
      throw new IllegalArgumentException("HTML 파일만 업로드 가능합니다: " + filename);
    }
  }

  private void validateCppFile(MultipartFile file, String fieldName) {
    String filename = file.getOriginalFilename();
    if (filename == null || !filename.toLowerCase().endsWith(".cpp")) {
      throw new IllegalArgumentException(fieldName + "는 .cpp 파일만 업로드 가능합니다: " + filename);
    }
  }

  private String normalizeContestPrefix() {
    String prefix = contestHtmlPrefix;
    if (prefix.startsWith("/")) {
      prefix = prefix.substring(1);
    }
    if (prefix.endsWith("/")) {
      prefix = prefix.substring(0, prefix.length() - 1);
    }
    return prefix;
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

  // backend-deploy/contest-resource/{contestId}/{visual-html|solo-html}/index.html
  private String buildContestResourceKey(Long contestId, ContestResourceType type) {
    return String.format("%s/%d/%s/index.html", normalizeContestPrefix(), contestId, type.directory());
  }

  private String buildJudgeCodeKey(Long contestId) {
    return String.format("%s/%d/judge-code/judge_code.cpp", normalizeContestCodePrefix(), contestId);
  }

  private String buildExampleCodeKey(Long contestId, String exampleCodeName) {
    String baseName = sanitizeCppBaseName(exampleCodeName);
    return String.format("%s/%d/example-code/%s.cpp", normalizeContestCodePrefix(), contestId, baseName);
  }

  private String buildSubmissionCodeKey(Long contestId, Long submissionId, Long userId, String extension) {
    return String.format("%s/%d/submissions/sub_%d_%d.%s",
        normalizeContestCodePrefix(),
        contestId,
        submissionId,
        userId,
        extension);
  }

  private String extensionByLanguage(Language language) {
    return switch (language) {
      case CPP -> "cpp";
      case JAVA -> "java";
      case PYTHON -> "py";
      case C -> "c";
    };
  }

  private String sanitizeCppBaseName(String fileName) {
    String defaultName = "example_code";
    if (fileName == null || fileName.isBlank()) {
      return defaultName;
    }

    String trimmed = fileName.trim();
    if (trimmed.toLowerCase().endsWith(".cpp")) {
      trimmed = trimmed.substring(0, trimmed.length() - 4);
    }

    String sanitized = trimmed.replaceAll("[^a-zA-Z0-9_-]", "_");
    if (sanitized.isBlank()) {
      return defaultName;
    }
    return sanitized;
  }

  private String buildPublicUrl(String key) {
    if (publicBaseUrl != null && !publicBaseUrl.isBlank()) {
      String base = publicBaseUrl.endsWith("/") ? publicBaseUrl.substring(0, publicBaseUrl.length() - 1)
          : publicBaseUrl;
      return base + "/" + key;
    }

    return String.format("https://%s.s3.%s.amazonaws.com/%s", bucket, region, key);
  }

  private void deleteObject(String key) {
    DeleteObjectRequest deleteRequest = DeleteObjectRequest.builder()
        .bucket(bucket)
        .key(key)
        .build();
    s3Client.deleteObject(deleteRequest);
    log.info("S3 객체 삭제 완료 - key: {}", key);
  }
}