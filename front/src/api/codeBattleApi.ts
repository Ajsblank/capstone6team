import axios from "axios";
import { SubmitRequest, SubmitResponse } from "../types";
import { getAccessToken } from "./authApi";
import { BattleMatchResult } from "./sseApi";

// 끝 슬래시 제거로 BASE_URL + "/path" 조합 시 // 방지
const BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

// ── 제출 종합 결과 (GET API 응답 / SSE submission-summary 동일 구조) ──
export interface SubmissionSummaryResponse {
  submissionId: number;
  userId: string;
  language: string;
  submittedAt: string; // ISO 8601
  wins: number;
  losses: number;
  totalMatches: number;
  matches: BattleMatchResult[];
}

export const SUBMIT_URL = `/api/code/submit/codebattle`;

export const submitCode = async (payload: SubmitRequest): Promise<SubmitResponse> => {
  const response = await api.post<SubmitResponse>("/api/code/submit/codebattle", payload);
  return response.data;
};

// ── 내 제출 목록 조회 — GET /api/contests/{contestId}/mySubmission ──
export const getMyBattleSubmissions = async (
  contestId: number
): Promise<SubmissionSummaryResponse[]> => {
  const response = await api.get<SubmissionSummaryResponse[]>(
    `/api/contests/${contestId}/mySubmission`
  );
  return response.data;
};
