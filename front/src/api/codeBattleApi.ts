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

export interface SampleCodeEntry {
  code: string;
  language: string;
}

export interface ExampleAiCodeEntry {
  code: string;
  description: string;
  language: string;
}

export interface ContestDetail {
  id: number;
  title: string;
  description: string;
  certification: boolean;
  timeLimitSec: number;
  memoryLimitMb: number;
  sampleCodes: SampleCodeEntry[];
  status: string;
  visualizationHtml: string;
  soloPlayHtml: string;
  startDate: string;
  endDate: string;
  maxParticipants: number;
  createdAt: string;
  exampleAiCodes: ExampleAiCodeEntry[];
  creator_id: number;
}

export interface ContestListResponse {
  content: ContestItem[];
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
}

export interface UserProfile {
  userId: number;
  nickname: string;
  tag: number;
  tagCode: string;
  nicknameTag: string;
  profileUrl: string;
  bio: string;
  affiliation: string;
  imageUrl: string;
}

export interface UserProfilePatch {
  nickname?: string;
  bio?: string;
  affiliation?: string;
  imageBase64?: string; // 서버가 S3에 업로드 (조회 시에는 UserProfile.imageUrl로 S3 URL 수신)
}

export interface LeaderboardStanding {
  user_id: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  rank: number;
}

export interface SessionLeaderboard {
  session_number: number;
  total_participants: number;
  total_rounds: number;
  final_standings: LeaderboardStanding[];
}

export interface MyMatchInfo {
  match_id: number;
  round_number: number;
  user1_id: number;
  user2_id: number | null;
  winner: 0 | 1 | 2 | null;
  result: "WIN1" | "WIN2" | "DRAW" | "BYE" | null;
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

// ── 제출 코드 조회 — GET /api/code/submission/{submissionId} ──
export interface SubmissionCode {
  submissionId: number;
  language: string;
  code: string;
  result: string;
  createdAt: string;
}

export const getSubmissionCode = async (submissionId: number): Promise<SubmissionCode> => {
  const { data } = await api.get<SubmissionCode>(`/api/code/submission/${submissionId}`);
  return data;
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
  match_ids?: number[];
}

export interface FinalResult {
  total_participants: number;
  "final-standings": FinalStanding[];
}

export const getFinalResult = async (contestId: number): Promise<FinalResult> => {
  const { data } = await api.get<FinalResult>(`/api/contests/${contestId}/final-result`);
  return data;
};

// ── 프로필 조회 — GET /api/profile/me ──
export const getMyProfile = async (): Promise<UserProfile> => {
  const { data } = await api.get<UserProfile>("/api/profile/me");
  return data;
};

// ── 프로필 수정 — PATCH /api/profile/me ──
export const updateMyProfile = async (patch: UserProfilePatch): Promise<UserProfile> => {
  const { data } = await api.patch<UserProfile>("/api/profile/me", patch);
  return data;
};

// ── 세션 리더보드 — GET /api/contests/{contestId}/sessionLeaderBoard ──
export const getSessionLeaderboard = async (contestId: number, sessionNumber: number): Promise<SessionLeaderboard> => {
  const { data } = await api.get<SessionLeaderboard>(`/api/contests/${contestId}/sessionLeaderBoard`, {
    params: { sessionNumber },
  });
  return data;
};

export const getMiddleRanking = async (contestId: number, sessionNumber: number, userId: number): Promise<MyMatchInfo[]> => {
  const { data } = await api.get<MyMatchInfo[]>(`/api/contests/${contestId}/${sessionNumber}/${userId}`);
  return data;
};

// ── 스위스 매치 로그 — GET /api/contests/{contestId}/swiss/viewMatchLog/{matchId} ──
export interface MatchLogDetail {
  log: string;
}

// ── 스위스 세션 예약 — POST /api/contests/{contestId}/scheduleSwissLeague ──
export const scheduleSwissLeague = async (contestId: number, scheduledAts: string[]): Promise<void> => {
  await api.post(`/api/contests/${contestId}/scheduleSwissLeague`, scheduledAts);
};

export const getSwissMatchLog = async (contestId: number, matchId: number): Promise<MatchLogDetail> => {
  const { data } = await api.get<MatchLogDetail>(`/api/contests/${contestId}/swiss/viewMatchLog/${matchId}`);
  return data;
};

// ── 풀리그 매치 로그 — GET /api/contests/{contestId}/fullLeague/viewMatchLog/{matchId} ──
// 서버가 plain string 또는 { log: string } 두 형태로 응답할 수 있어 양쪽을 모두 처리
export const getFullLeagueMatchLog = async (contestId: number, matchId: number): Promise<string> => {
  const { data } = await api.get<any>(`/api/contests/${contestId}/fullLeague/viewMatchLog/${matchId}`);
  return typeof data === "string" ? data : (data?.log ?? "");
};

// ── 검수 코드 대결 — POST /api/code/submit/test (결과는 SSE test_result 이벤트로 수신) ──
export const reviewContest = async (
  userId: string,
  problemId: string,
  language1: string,
  language2: string,
  sourceCode1: string,
  sourceCode2: string,
  signal?: AbortSignal
): Promise<void> => {
  await api.post(
    `/api/code/submit/test`,
    { userId, problemId, language1, language2, sourceCode1, sourceCode2 },
    { signal }
  );
};
