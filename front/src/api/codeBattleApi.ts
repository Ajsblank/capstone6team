import axios from "axios";
import { SubmitRequest, SubmitResponse } from "../types";
import { getAccessToken, applyAuthInterceptor } from "./authApi";

export interface ContestItem {
  id: number;
  title: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  maxParticipants?: number;
}

export interface ContestDetail {
  id: number;
  title: string;
  description: string;
  certification: boolean;
  timeLimitSec: number;
  memoryLimitMb: number;
  sampleCode: string;
  status: string;
  visualizationHtml: string;
  soloPlayHtml: string;
  startDate: string;
  endDate: string;
  maxParticipants: number;
  createdAt: string;
  exampleAiCodes: string[];
  creator_id: number;
}

export interface ContestListResponse {
  content: ContestItem[];
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
}


// 끝 슬래시 제거로 BASE_URL + "/path" 조합 시 // 방지
const BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});
applyAuthInterceptor(api);

export const submitCode = async (payload: SubmitRequest): Promise<SubmitResponse> => {
  const response = await api.post<SubmitResponse>("/api/code/submit/codebattle", payload);
  return response.data;
};

// ── 대회 목록 조회 — GET /api/contests/list ──
export const getContestList = async (
  page: number,
  size: number,
  sort: string[] = []
): Promise<ContestListResponse> => {
  const params = new URLSearchParams();
  params.append("page", String(page));
  params.append("size", String(size));
  sort.forEach((s) => params.append("sort", s));
  const response = await api.get<ContestListResponse>(`/api/contests/list?${params.toString()}`);
  return response.data;
};

// ── 대회 상세 조회 — GET /api/contests/{contestId} ──
export const getContestDetail = async (contestId: number): Promise<ContestDetail> => {
  const { data } = await api.get<ContestDetail>(`/api/contests/${contestId}`);
  return data;
};

export interface ContestMatchResult {
  aiId: number;
  status: "WIN" | "LOSE" | "DRAW";
  log: string;
}

export interface ContestSubmissionResponse {
  submissionId: number;
  createdAt: string;
  result: ContestMatchResult;
}

// ── 대회 참가 — POST /api/contests/{contestId}/join?email={email} ──
export const joinContest = async (contestId: number, email: string): Promise<void> => {
  await api.post(`/api/contests/${contestId}/join`, null, { params: { email } });
};

// ── 내 제출 목록 조회 — GET /api/contests/{contestId}/{targetUserId} ──
export const getMyBattleSubmissions = async (
  contestId: number,
  targetUserId: string
): Promise<ContestSubmissionResponse[]> => {
  const response = await api.get<ContestSubmissionResponse[]>(
    `/api/contests/${contestId}/${targetUserId}`
  );
  return response.data;
};

// ── 세션 목록 조회 — GET /api/contests/{contestId}/sessionList ──
export interface ContestSession {
  sessionNumber: number;
  scheduledAt: string | null;
  status: string; // "RUNNING" | "END" | ...
}

export const getContestSessions = async (contestId: number): Promise<ContestSession[]> => {
  const { data } = await api.get<ContestSession[]>(`/api/contests/${contestId}/sessionList`);
  return data;
};

// ── 최종 결과 조회 — GET /api/contests/{contestId}/final-result ──
export interface FinalStanding {
  user_id: number;
  wins: number;
  draws: number;
  losses: number;
  rank: number;
  points: number;
}

export interface FinalResult {
  total_participants: number;
  "final-standings": FinalStanding[];
}

export const getFinalResult = async (contestId: number): Promise<FinalResult> => {
  const { data } = await api.get<FinalResult>(`/api/contests/${contestId}/final-result`);
  return data;
};

// ── 검수 코드 대결 — POST /api/code/submit/test (결과는 SSE test_result 이벤트로 수신) ──
export const reviewContest = async (
  userId: string,
  problemId: string,
  sourceCode1: string,
  sourceCode2: string,
  signal?: AbortSignal
): Promise<void> => {
  await api.post(
    `/api/code/submit/test`,
    { userId, problemId, sourceCode1, sourceCode2 },
    { signal }
  );
};
