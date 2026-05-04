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

type MatchCallback   = (result: BattleMatchResult) => void;
type SummaryCallback = (summary: SubmissionSummary) => void;

let emitter: EventSource | null = null;
let matchCallback:   MatchCallback   | null = null;
let summaryCallback: SummaryCallback | null = null;
let lastUserId: string | null = null;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const MAX_RECONNECT    = 5;
const RECONNECT_BASE_MS = 2000;

// ── 내부 연결 함수 (초기 연결 + 재연결 공유) ──
function connectSSE(userId: string): void {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (emitter) emitter.close();

  const token = getAccessToken();
  const url = `${BASE_URL}/api/subscribe/${userId}?token=${token ?? ""}`;
  emitter = new EventSource(url);

  // 연결 성공 시 재시도 카운터 초기화
  emitter.onopen = () => {
    reconnectAttempts = 0;
  };

  // 단일 매치 결과
  emitter.addEventListener("match-result", (e) => {
    try {
      const result: BattleMatchResult = JSON.parse((e as MessageEvent).data);
      matchCallback?.(result);
    } catch (err) {
      console.warn("[SSE] match-result parse error:", err);
    }
  });

  // 제출 종합 결과
  emitter.addEventListener("submission-summary", (e) => {
    try {
      const summary: SubmissionSummary = JSON.parse((e as MessageEvent).data);
      summaryCallback?.(summary);
    } catch (err) {
      console.warn("[SSE] submission-summary parse error:", err);
    }
  });

  // 이벤트 이름 없는 기본 메시지 (하위 호환)
  emitter.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if ("matchId" in data) matchCallback?.(data as BattleMatchResult);
    } catch (err) {
      console.warn("[SSE] parse error:", err);
    }
  };

  // 연결 끊김 → 지수 백오프 재연결
  emitter.onerror = () => {
    emitter?.close();
    emitter = null;
    if (reconnectAttempts < MAX_RECONNECT && lastUserId) {
      const delay = RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts);
      reconnectAttempts++;
      console.warn(`[SSE] 연결 끊김 — ${delay}ms 후 재연결 시도 (${reconnectAttempts}/${MAX_RECONNECT})`);
      reconnectTimer = setTimeout(() => connectSSE(lastUserId!), delay);
    } else {
      console.warn("[SSE] 재연결 횟수 초과 — 연결을 포기합니다.");
    }
  };
}

// SSE 구독 — 로그인 직후 호출
export const subscribeToResults = (userId: string, onMatch: MatchCallback) => {
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
};
