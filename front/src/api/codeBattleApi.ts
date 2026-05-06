import axios from "axios";
import { SubmitRequest, SubmitResponse } from "../types";
import { getAccessToken } from "./authApi";
import type { SubmissionSummary } from "./sseApi";

export interface ContestItem {
  id: number;
  title: string;
  description?: string;
  status?: string;
  startTime?: string;
  endTime?: string;
  problemTitle?: string;
}

export interface ContestListResponse {
  content: ContestItem[];
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
}

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
