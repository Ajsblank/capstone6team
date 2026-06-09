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

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      // 서버 에러 본문({"error":"..."} 또는 {"message":"..."} 또는 평문)을 메시지로 전달
      let msg = bodyText;
      try {
        const j = JSON.parse(bodyText);
        msg = j?.error ?? j?.message ?? bodyText;
      } catch { /* 평문 그대로 사용 */ }
      throw new Error(msg || `검증 요청 실패: ${response.status}`);
    }

  } catch (error) {
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
  setValidationResultCallback((result: ValidationResult) => {
    onResult(result);
  });
}

/**
 * 검증 결과 콜백 제거
 */
export function unsubscribeFromValidationResults(): void {
  setValidationResultCallback(null);
}
