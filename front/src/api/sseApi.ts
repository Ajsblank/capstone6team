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

type MatchCallback     = (result: BattleMatchResult) => void;
type SummaryCallback   = (summary: SubmissionSummary) => void;
type StatusCallback    = (status: SseStatus) => void;
type ReconnectCallback = () => void;   // SSE 재연결 완료 시 호출

let emitter: EventSource | null = null;
let matchCallback:     MatchCallback     | null = null;
let summaryCallback:   SummaryCallback   | null = null;
let statusCallback:    StatusCallback    | null = null;
let reconnectCallback: ReconnectCallback | null = null;
let lastUserId: string | null = null;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isFirstConnect = true;   // 최초 연결인지 재연결인지 구분

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

export const setReconnectCallback = (cb: ReconnectCallback | null) => {
  reconnectCallback = cb;
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
    const wasReconnect = !isFirstConnect;
    isFirstConnect = false;
    console.log(`[SSE] 연결 성공 (${wasReconnect ? "재연결" : "최초"}) — readyState:`, emitter?.readyState);
    notifyStatus("connected");
    if (wasReconnect) {
      console.log("[SSE] 재연결 완료 — reconnectCallback 호출");
      reconnectCallback?.();
    }
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
  // 서버가 named event 대신 일반 message로 보낼 경우 여기서 처리
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
  console.log("재연결 시도 횟수    :", reconnectAttempts, "/", MAX_RECONNECT);
  console.log("BASE_URL            :", BASE_URL || "(비어 있음 — REACT_APP_API_BASE_URL 미설정)");
  console.groupEnd();
};

// 개발 환경에서 브라우저 콘솔에서 window.__debugSse() 로 직접 호출 가능
if (process.env.NODE_ENV === "development") {
  (window as any).__debugSse = debugSse;
}

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
