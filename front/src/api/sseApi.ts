import { getAccessToken } from "./authApi";

const BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");

// ── 단일 매치 결과 (백엔드 CodeBattleMatchResult 대응) ──
export interface BattleMatchResult {
  matchId: number;
  winner: string; // userId와 일치하면 내가 이긴 것
  log: string;
}

// ── 제출 종합 결과 (모든 매치 완료 후 수신) ──
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

// SSE 구독 — 로그인 직후 호출
// TODO: 백엔드에서 EventSource 쿼리 파라미터 토큰 인증 지원 필요 (?token=...)
export const subscribeToResults = (userId: string, onMatch: MatchCallback) => {
  if (emitter) emitter.close();
  matchCallback = onMatch;

  const token = getAccessToken();
  const url = `${BASE_URL}/api/subscribe/${userId}?token=${token ?? ""}`;
  emitter = new EventSource(url);

  // 단일 매치 결과 — 이벤트 이름: "match-result"
  emitter.addEventListener("match-result", (e) => {
    try {
      const result: BattleMatchResult = JSON.parse((e as MessageEvent).data);
      matchCallback?.(result);
    } catch (err) {
      console.warn("[SSE] match-result parse error:", err);
    }
  });

  // 제출 종합 결과 — 이벤트 이름: "submission-summary"
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
      // matchId 필드가 있으면 단일 매치 결과로 간주
      if ("matchId" in data) matchCallback?.(data as BattleMatchResult);
    } catch (err) {
      console.warn("[SSE] parse error:", err);
    }
  };

  emitter.onerror = () => {
    console.warn("[SSE] connection error");
    emitter?.close();
    emitter = null;
  };
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
  emitter?.close();
  emitter = null;
  matchCallback   = null;
  summaryCallback = null;
};
