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
  notifyStatus("connecting");
  emitter = new EventSource(url);

  emitter.onopen = () => {
    const wasReconnect = !isFirstConnect;
    isFirstConnect = false;
    notifyStatus("connected");
    if (wasReconnect) {
      reconnectCallback?.();
    }
  };

  // 단일 매치 결과 (백엔드 이름: match_result)
  const handleMatchResult = (e: Event) => {
    try {
      const result: BattleMatchResult = JSON.parse((e as MessageEvent).data);
      matchCallback?.(result);
    } catch {
      // parse 오류 무시
    }
  };
  emitter.addEventListener("match_result", handleMatchResult);
  emitter.addEventListener("match-result", handleMatchResult); // 하이픈 버전 호환

  // 제출 종합 결과
  const handleSummary = (e: Event) => {
    try {
      const summary: SubmissionSummary = JSON.parse((e as MessageEvent).data);
      summaryCallback?.(summary);
    } catch {
      // parse 오류 무시
    }
  };
  emitter.addEventListener("submission_summary", handleSummary);
  emitter.addEventListener("submission-summary", handleSummary); // 하이픈 버전 호환

  // 검수 결과 (백엔드 이름: test_result)
  emitter.addEventListener("test_result", (e: Event) => {
    testResultCallback?.((e as MessageEvent).data);
  });

  // 대회 검증 결과 (백엔드 이름: validate_result)
  emitter.addEventListener("validate_result", (e: Event) => {
    try {
      const result = JSON.parse((e as MessageEvent).data);
      validationResultCallback?.(result);
    } catch {
      // parse 오류 무시
    }
  });

  // 이벤트 이름 없는 기본 메시지 (하위 호환)
  emitter.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if ("matchId" in data) {
        matchCallback?.(data as BattleMatchResult);
      } else if ("submissionId" in data && "wins" in data) {
        summaryCallback?.(data as SubmissionSummary);
      }
    } catch {
      // parse 오류 무시
    }
  };

  // 연결 끊김 → 지수 백오프 재연결
  // 오류 처리 — 브라우저 EventSource의 기본 자동 재연결에 위임
  // (emitter.close()를 호출하지 않으면 readyState=CONNECTING으로 브라우저가 자동 재시도)
  emitter.onerror = () => {
    const state = emitter?.readyState;
    if (state === EventSource.CONNECTING) {
      notifyStatus("connecting");
    } else if (state === EventSource.CLOSED) {
      emitter = null;
      notifyStatus("disconnected");
    }
  };
}

// SSE 구독 — 로그인 직후 또는 페이지 로드 시 호출
export const subscribeToResults = (userId: string, onMatch: MatchCallback) => {
  if (lastUserId === userId && emitter && emitter.readyState !== EventSource.CLOSED) {
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
  if (lastUserId === userId && emitter && emitter.readyState !== EventSource.CLOSED) {
    return;
  }

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

// 현재 SSE 상태 덤프 (no-op in production)
export const debugSse = () => {};

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
