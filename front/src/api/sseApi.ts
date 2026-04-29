import { getAccessToken } from "./authApi";

const BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");

export interface BattleMatchResult {
  matchId: number;
  winner: string; // 백엔드 CodeBattleMatchResult.winner 값 그대로
  log: string;
}

type MatchCallback = (result: BattleMatchResult) => void;

let emitter: EventSource | null = null;
let matchCallback: MatchCallback | null = null;

// SSE 구독 — 로그인 직후 호출
// TODO: 백엔드에서 EventSource 쿼리 파라미터 토큰 인증 지원 필요 (?token=...)
export const subscribeToResults = (userId: string, onMatch: MatchCallback) => {
  if (emitter) emitter.close();
  matchCallback = onMatch;

  const token = getAccessToken();
  const url = `${BASE_URL}/api/subscribe/${userId}?token=${token ?? ""}`;
  emitter = new EventSource(url);

  emitter.onmessage = (e) => {
    try {
      const result: BattleMatchResult = JSON.parse(e.data);
      matchCallback?.(result);
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

// 로그아웃 시 연결 해제
export const unsubscribeFromResults = () => {
  emitter?.close();
  emitter = null;
  matchCallback = null;
};
