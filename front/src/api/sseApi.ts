import { getAccessToken } from "./authApi";


const BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");

// ── 단일 매치 결과 ──
export interface BattleMatchResult {
  matchId: number;
  winner: string; // userId와 일치하면 내가 이긴 것
  log: string;
}

// ── 제출 종합 결과 (모든 매치 완료 후 수신) — 정규 타입 ──
export interface SubmissionSummary {
  submissionId: number;
  userId: string;
  language: string;
  submittedAt: string; // ISO 8601
  wins: number;
  losses: number;
  totalMatches: number;
  matches: BattleMatchResult[];
}

export type SseStatus = "connected" | "connecting" | "disconnected";

type MatchCallback           = (result: BattleMatchResult) => void;
type SummaryCallback         = (summary: SubmissionSummary) => void;
type TestResultCallback      = (log: string) => void;
type StatusCallback          = (status: SseStatus) => void;
type ReconnectCallback       = () => void;
type ValidationResultCallback = (result: any) => void;

let emitter: EventSource | null = null;
let matchCallback:           MatchCallback           | null = null;
let summaryCallback:         SummaryCallback         | null = null;
let testResultCallback:      TestResultCallback      | null = null;
let statusCallback:          StatusCallback          | null = null;
let reconnectCallback:       ReconnectCallback       | null = null;
let validationResultCallback: ValidationResultCallback | null = null;
let lastUserId: string | null = null;
let isFirstConnect = true;   // 최초 연결인지 (네이티브) 재연결인지 구분

function notifyStatus(s: SseStatus) {
  statusCallback?.(s);
}

export const getSseStatus = (): SseStatus => {
  if (!emitter) return "disconnected";
  if (emitter.readyState === EventSource.OPEN) return "connected";
  if (emitter.readyState === EventSource.CONNECTING) return "connecting";
  return "disconnected";
};

export const setStatusCallback = (cb: StatusCallback | null) => {
  statusCallback = cb;
};

export const setReconnectCallback = (cb: ReconnectCallback | null) => {
  reconnectCallback = cb;
};

// ── 내부 연결 함수 ──
function connectSSE(userId: string): void {
  if (emitter) emitter.close();

  const token = getAccessToken();
  const url = `${BASE_URL}/api/subscribe/${userId}?token=${token ?? ""}`;
  console.log(`[SSE] ========== SSE EventSource 생성 ==========`);
  console.log(`[SSE] URL: ${url.replace(/token=[^&]*/, "token=***")}`);
  console.log(`[SSE] userId: ${userId}`);
  console.log(`[SSE] 토큰 상태: ${token ? "있음" : "없음"}`);
  console.log(`[SSE] 연결 시도 중...`);
  notifyStatus("connecting");
  emitter = new EventSource(url);

  emitter.onopen = () => {
    const wasReconnect = !isFirstConnect;
    isFirstConnect = false;
    console.log(`[SSE] ========== SSE 연결 성공 ==========`);
    console.log(`[SSE] 유형: ${wasReconnect ? "재연결" : "최초 연결"}`);
    console.log(`[SSE] readyState: ${emitter?.readyState} (CONNECTING=0, OPEN=1, CLOSED=2)`);
    console.log(`[SSE] 이제 다음 이벤트를 수신 준비:`, [
      "match_result",
      "submission_summary",
      "test_result",
      "validate_result"
    ]);
    notifyStatus("connected");
    if (wasReconnect) {
      console.log("[SSE] 재연결 완료 — reconnectCallback 호출");
      reconnectCallback?.();
    }
  };

  // 단일 매치 결과 (백엔드 이름: match_result)
  const handleMatchResult = (e: Event) => {
    console.log("[SSE] match_result 수신:", (e as MessageEvent).data);
    try {
      const result: BattleMatchResult = JSON.parse((e as MessageEvent).data);
      matchCallback?.(result);
    } catch (err) {
      console.warn("[SSE] match_result parse 오류:", err);
    }
  };
  emitter.addEventListener("match_result", handleMatchResult);
  emitter.addEventListener("match-result", handleMatchResult); // 하이픈 버전 호환

  // 제출 종합 결과
  const handleSummary = (e: Event) => {
    console.log("[SSE] submission_summary 수신:", (e as MessageEvent).data);
    try {
      const summary: SubmissionSummary = JSON.parse((e as MessageEvent).data);
      summaryCallback?.(summary);
    } catch (err) {
      console.warn("[SSE] submission_summary parse 오류:", err);
    }
  };
  emitter.addEventListener("submission_summary", handleSummary);
  emitter.addEventListener("submission-summary", handleSummary); // 하이픈 버전 호환

  // 검수 결과 (백엔드 이름: test_result)
  emitter.addEventListener("test_result", (e: Event) => {
    console.log("[SSE] test_result 수신:", (e as MessageEvent).data);
    testResultCallback?.((e as MessageEvent).data);
  });

  // 대회 검증 결과 (백엔드 이름: validate_result)
  emitter.addEventListener("validate_result", (e: Event) => {
    console.log("[SSE] ========== validate_result 이벤트 수신 ==========");
    console.log("[SSE] 원본 데이터:", (e as MessageEvent).data);
    try {
      const result = JSON.parse((e as MessageEvent).data);
      console.log("[SSE] 파싱된 결과:", result);
      console.log("[SSE] validationResultCallback 호출");
      validationResultCallback?.(result);
    } catch (err) {
      console.warn("[SSE] validate_result parse 오류:", err);
    }
  });

  // 이벤트 이름 없는 기본 메시지 (하위 호환)
  emitter.onmessage = (e) => {
    console.log("[SSE] onmessage (unnamed) — raw:", e.data);
    try {
      const data = JSON.parse(e.data);
      console.log("[SSE] onmessage parsed:", data);
      if ("matchId" in data) {
        console.log("[SSE] → matchCallback 호출 (onmessage 경로)");
        matchCallback?.(data as BattleMatchResult);
      } else if ("submissionId" in data && "wins" in data) {
        console.log("[SSE] → summaryCallback 호출 (onmessage 경로)");
        summaryCallback?.(data as SubmissionSummary);
      } else {
        console.log("[SSE] onmessage — 처리 불가 형식:", data);
      }
    } catch (err) {
      console.warn("[SSE] onmessage parse 오류:", err);
    }
  };

  // 연결 끊김 → 지수 백오프 재연결
  // 오류 처리 — 브라우저 EventSource의 기본 자동 재연결에 위임
  // (emitter.close()를 호출하지 않으면 readyState=CONNECTING으로 브라우저가 자동 재시도)
  emitter.onerror = (e) => {
    const state = emitter?.readyState;
    console.warn(`[SSE] 연결 오류 — readyState: ${state} (CONNECTING=0, OPEN=1, CLOSED=2)`, e);

    if (state === EventSource.CONNECTING) {
      // 일시적 끊김: 브라우저가 자동으로 재연결 중
      console.info("[SSE] 브라우저 기본 자동 재연결 진행 중...");
      notifyStatus("connecting");
    } else if (state === EventSource.CLOSED) {
      // 치명적 오류(서버가 비정상 응답 등): 브라우저가 더 이상 재시도하지 않음
      console.warn("[SSE] 연결이 종료되어 자동 재연결되지 않습니다.");
      emitter = null;
      notifyStatus("disconnected");
    }
  };
}

// SSE 구독 — 로그인 직후 또는 페이지 로드 시 호출
export const subscribeToResults = (userId: string, onMatch: MatchCallback) => {
  if (lastUserId === userId && emitter && emitter.readyState !== EventSource.CLOSED) {
    const stateLabel = emitter.readyState === EventSource.OPEN ? "OPEN(1)" : "CONNECTING(0)";
    console.log(`[SSE] emitter 존재(${stateLabel}) — 중복 생성 스킵, userId:`, userId);
    matchCallback = onMatch;
    return;
  }
  lastUserId = userId;
  matchCallback = onMatch;
  isFirstConnect = true;
  connectSSE(userId);
};

// SSE 연결만 보장 — 콜백은 건드리지 않음 (AppContext 전용)
export const ensureSseConnected = (userId: string) => {
  console.log(`[ensureSseConnected] 호출됨 — userId: ${userId}`);
  console.log(`[ensureSseConnected] 현재 상태:`, {
    lastUserId,
    emitterExists: !!emitter,
    readyState: emitter?.readyState,
    isConnected: emitter && emitter.readyState !== EventSource.CLOSED
  });

  if (lastUserId === userId && emitter && emitter.readyState !== EventSource.CLOSED) {
    console.log(`[ensureSseConnected] 이미 동일한 userId로 연결됨 — 스킵`);
    return;
  }

  console.log(`[ensureSseConnected] 새 SSE 연결 시작`);
  lastUserId = userId;
  isFirstConnect = true;
  connectSSE(userId);
};

// 연결은 유지하고 콜백만 교체 — 페이지 이동 시 사용
export const setMatchCallback = (onMatch: MatchCallback) => {
  matchCallback = onMatch;
};

export const setSummaryCallback = (onSummary: SummaryCallback) => {
  summaryCallback = onSummary;
};

export const setTestResultCallback = (cb: TestResultCallback | null) => {
  testResultCallback = cb;
};

export const setValidationResultCallback = (cb: ValidationResultCallback | null) => {
  validationResultCallback = cb;
};

// 현재 SSE 상태 콘솔 덤프 — 디버깅용
export const debugSse = () => {
  const stateLabel = !emitter ? "없음"
    : emitter.readyState === EventSource.CONNECTING ? "CONNECTING(0)"
    : emitter.readyState === EventSource.OPEN       ? "OPEN(1)"
    : "CLOSED(2)";
  const url = lastUserId
    ? `${BASE_URL}/api/subscribe/${lastUserId}?token=***`
    : "(미연결)";
  console.group("[SSE] 현재 상태 덤프");
  console.log("readyState          :", stateLabel);
  console.log("접속 URL            :", url);
  console.log("lastUserId          :", lastUserId);
  console.log("matchCallback 등록  :", matchCallback !== null);
  console.log("summaryCallback 등록:", summaryCallback !== null);
  console.log("testResultCallback 등록:", testResultCallback !== null);
  console.log("validationResultCallback 등록:", validationResultCallback !== null);
  console.log("재연결 방식         :", "브라우저 EventSource 기본 자동 재연결");
  console.log("BASE_URL            :", BASE_URL || "(비어 있음 — REACT_APP_API_BASE_URL 미설정)");
  console.groupEnd();
};

// 개발 환경에서 브라우저 콘솔에서 window.__debugSse() 로 직접 호출 가능
if (process.env.NODE_ENV === "development") {
  (window as any).__debugSse = debugSse;
}

// 로그아웃 시 연결 해제
export const unsubscribeFromResults = () => {
  emitter?.close();
  emitter = null;
  matchCallback           = null;
  summaryCallback        = null;
  testResultCallback     = null;
  validationResultCallback = null;
  lastUserId             = null;
  notifyStatus("disconnected");
};
