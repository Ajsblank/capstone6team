import axios from "axios";
import { SubmitRequest, SubmitResponse, SubmissionsPageResponse } from "../types";
import { getAccessToken } from "./authApi";

// 끝 슬래시 제거로 BASE_URL + "/path" 조합 시 // 방지
const BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

export const SUBMIT_URL = `/api/code/submit/codebattle`;

export const submitCode = async (payload: SubmitRequest): Promise<SubmitResponse> => {
  const response = await api.post<SubmitResponse>("/api/code/submit/codebattle", payload);
  return response.data;
};

// ── 내 제출 이력 ──────────────────────────────────────────────────────

export const getMySubmissions = async (
  contestId: number = 1,
  page: number = 0,
  size: number = 10
): Promise<SubmissionsPageResponse> => {
  const response = await api.get<SubmissionsPageResponse>(
    `/contests/${contestId}/submissions`,
    { params: { page, size } }
  );
  return response.data;
};
