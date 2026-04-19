export type Language = "cpp" | "java" | "python" ;

export interface Problem {
  id: number;
  title: string;
  description: string;
  inputFormat: string;
  outputFormat: string;
  examples: { input: string; output: string }[];
  constraints: string[];
  timeLimit: number; // ms
  memoryLimit: number; // MB
}

// ── 내 제출 이력 ──────────────────────────────────────────────────────

export interface MatchRoundLog {
  round: number;
  p1Cards: string[];
  p2Cards: string[];
  p1HpAfter: number;
  p2HpAfter: number;
  roundWinner: "p1" | "p2" | "draw";
}

export interface MatchResult {
  matchId: number;
  opponentName: string;
  result: "WIN" | "LOSS" | "DRAW";
  rounds: MatchRoundLog[];  // TODO: 서버 응답 필드명 확인 필요
}

export interface SubmissionRecord {
  submissionId: number;
  submittedAt: string;      // ISO 8601
  language: string;
  wins: number;
  losses: number;
  draws: number;
  matches: MatchResult[];   // TODO: 별도 API로 분리될 경우 lazy load 고려
}

export interface SubmissionsPageResponse {
  content: SubmissionRecord[];
  totalPages: number;
  totalElements: number;
  number: number;           // 현재 페이지 (0-based)
  size: number;
}

// ─────────────────────────────────────────────────────────────────────

export interface SubmitRequest {
  userId: string;
  problemId?: string;
  language: string;
  sourceCode: string;
}

export interface SubmitResponse {
  success: boolean;
  message: string;
}
