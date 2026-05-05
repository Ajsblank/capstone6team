import axios from "axios";
import { SubmitRequest, SubmitResponse } from "../types";
import { getAccessToken } from "./authApi";
import type { SubmissionSummary } from "./sseApi";

// ── SubmissionSummaryResponse = sseApi.SubmissionSummary (단일 정의) ──
export type { SubmissionSummary as SubmissionSummaryResponse } from "./sseApi";

// 끝 슬래시 제거로 BASE_URL + "/path" 조합 시 // 방지
const BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

export const submitCode = async (payload: SubmitRequest): Promise<SubmitResponse> => {
  const response = await api.post<SubmitResponse>("/api/code/submit/codebattle", payload);
  return response.data;
};

// ── 내 제출 목록 조회 — GET /api/contests/{contestId}/{targetUserId} ──
export const getMyBattleSubmissions = async (
  contestId: number,
  targetUserId: string
): Promise<SubmissionSummary[]> => {
  const response = await api.get<SubmissionSummary[]>(
    `/api/contests/${contestId}/${targetUserId}`
  );
  return response.data;
};
