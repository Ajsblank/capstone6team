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

type MatchCallback   = (result: BattleMatchResult) => void;
type SummaryCallback = (summary: SubmissionSummary) => void;
type StatusCallback  = (status: SseStatus) => void;

let emitter: EventSource | null = null;
let matchCallback:   MatchCallback   | null = null;
let summaryCallback: SummaryCallback | null = null;
let statusCallback:  StatusCallback  | null = null;
let lastUserId: string | null = null;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const MAX_RECONNECT    = 5;
const RECONNECT_BASE_MS = 2000;

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

// ── 내부 연결 함수 (초기 연결 + 재연결 공유) ──
function connectSSE(userId: string): void {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (emitter) emitter.close();

  const token = getAccessToken();
  const url = `${BASE_URL}/api/subscribe/${userId}?token=${token ?? ""}`;
  console.log(`[SSE] 연결 시도 — userId: ${userId}, url: ${url.replace(/token=[^&]*/, "token=***")}`);
  notifyStatus("connecting");
  emitter = new EventSource(url);

  emitter.onopen = () => {
    reconnectAttempts = 0;
    console.log("[SSE] 연결 성공 — readyState:", emitter?.readyState);
    notifyStatus("connected");
  };

  // 단일 매치 결과
  emitter.addEventListener("match-result", (e) => {
    console.log("[SSE] match-result 수신:", (e as MessageEvent).data);
    try {
      const result: BattleMatchResult = JSON.parse((e as MessageEvent).data);
      matchCallback?.(result);
    } catch (err) {
      console.warn("[SSE] match-result parse 오류:", err);
    }
  });

  // 제출 종합 결과
  emitter.addEventListener("submission-summary", (e) => {
    console.log("[SSE] submission-summary 수신:", (e as MessageEvent).data);
    try {
      const summary: SubmissionSummary = JSON.parse((e as MessageEvent).data);
      summaryCallback?.(summary);
    } catch (err) {
      console.warn("[SSE] submission-summary parse 오류:", err);
    }
  });

  // 이벤트 이름 없는 기본 메시지 (하위 호환)
  emitter.onmessage = (e) => {
    console.log("[SSE] onmessage (unnamed event):", e.data);
    try {
      const data = JSON.parse(e.data);
      if ("matchId" in data) matchCallback?.(data as BattleMatchResult);
    } catch (err) {
      console.warn("[SSE] onmessage parse 오류:", err);
    }
  };

  // 연결 끊김 → 지수 백오프 재연결
  emitter.onerror = (e) => {
    const state = emitter?.readyState;
    console.error(`[SSE] 연결 오류 — readyState: ${state}`, e);
    emitter?.close();
    emitter = null;
    notifyStatus("disconnected");
    if (reconnectAttempts < MAX_RECONNECT && lastUserId) {
      const delay = RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts);
      reconnectAttempts++;
      console.warn(`[SSE] ${delay}ms 후 재연결 시도 (${reconnectAttempts}/${MAX_RECONNECT})`);
      notifyStatus("connecting");
      reconnectTimer = setTimeout(() => connectSSE(lastUserId!), delay);
    } else {
      console.warn("[SSE] 재연결 횟수 초과 — 연결 포기");
    }
  };
}

// SSE 구독 — 로그인 직후 또는 페이지 로드 시 호출
export const subscribeToResults = (userId: string, onMatch: MatchCallback) => {
  if (lastUserId === userId && emitter && emitter.readyState !== EventSource.CLOSED) {
    console.log("[SSE] 이미 연결됨 — 재연결 스킵, userId:", userId);
    matchCallback = onMatch;
    return;
  }
  lastUserId = userId;
  matchCallback = onMatch;
  reconnectAttempts = 0;
  connectSSE(userId);
};

// 연결은 유지하고 콜백만 교체 — 페이지 이동 시 사용
export const setMatchCallback = (onMatch: MatchCallback) => {
  matchCallback = onMatch;
};

export const setSummaryCallback = (onSummary: SummaryCallback) => {
  summaryCallback = onSummary;
};

// 로그아웃 시 연결 해제
export const unsubscribeFromResults = () => {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  emitter?.close();
  emitter = null;
  matchCallback    = null;
  summaryCallback  = null;
  lastUserId       = null;
  reconnectAttempts = 0;
  notifyStatus("disconnected");
};
