import { getAccessToken } from "./authApi";
import { setValidationResultCallback } from "./sseApi";

const BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");

export interface ValidateRequestPayload {
  judgeCode: string;
  sampleCodes: Array<{ code: string; language: string }>;
  exampleAiCodes: Array<{ code: string; language: string; description: string }>;
}

export interface ValidationDetail {
  target: string;
  passed: boolean;
  log: string;
  reason?: string;
}

export interface ValidationResult {
  passed: boolean;
  details: ValidationDetail[];
}

/**
 * 대회 코드 검증 API 호출
 * POST /api/contests/validate
 *
 * 주의: SSE는 AppContext에서 로그인 후 미리 연결되어 있습니다.
 * 백엔드로부터 validate_result 이벤트를 수신하려면
 * setValidationResultCallback을 호출하여 콜백을 등록하세요.
 */
export async function validateContestCode(
  payload: ValidateRequestPayload
): Promise<void> {
  const url = `${BASE_URL}/api/contests/validate`;
  const token = getAccessToken();
  console.log("[validateContestCode] 요청 시작:", url, "token:", token ? "있음" : "없음");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("[validateContestCode] 응답 상태:", response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error("[validateContestCode] 오류:", error);
      throw new Error(`검증 요청 실패: ${response.status}`);
    }

    console.log("[validateContestCode] 202 Accepted - SSE를 통해 결과 대기");
  } catch (error) {
    console.error("[validateContestCode] 예외:", error);
    throw error;
  }
}

/**
 * 검증 결과 콜백 등록 (sseApi.ts의 전역 SSE 연결 사용)
 */
export function subscribeToValidationResults(
  onResult: (result: ValidationResult) => void,
  onError: (error: Error) => void
): void {
  console.log("[subscribeToValidationResults] 검증 결과 콜백 등록");

  setValidationResultCallback((result: ValidationResult) => {
    console.log("[subscribeToValidationResults] 검증 결과 수신:", result);
    console.log("  - 전체 통과:", result.passed);
    result.details.forEach((detail, idx) => {
      console.log(`  [${idx + 1}] ${detail.target}`);
      console.log(`      통과: ${detail.passed}`);
      if (detail.reason) console.log(`      사유: ${detail.reason}`);
      console.log(`      로그: ${detail.log}`);
    });
    onResult(result);
  });
}

/**
 * 검증 결과 콜백 제거
 */
export function unsubscribeFromValidationResults(): void {
  console.log("[unsubscribeFromValidationResults] 검증 결과 콜백 제거");
  setValidationResultCallback(null);
}
