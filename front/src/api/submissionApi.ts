import axios from "axios";
import { SubmitRequest, SubmitResponse, SubmissionsPageResponse } from "../types";
import { getAccessToken } from "./authApi";

const BASE_URL = process.env.REACT_APP_API_BASE_URL || "";

export const SUBMIT_URL = `${BASE_URL}/api/code/submit`;

export const submitCode = async (payload: SubmitRequest): Promise<SubmitResponse> => {
  const response = await axios.post<SubmitResponse>(SUBMIT_URL, payload);
  return response.data;
};

// ── 내 제출 이력 ──────────────────────────────────────────────────────

// TODO: contestId는 현재 치토 배틀 고정값(1) 사용 — 다중 대회 지원 시 동적으로 전달
export const getMySubmissions = async (
  contestId: number = 1,
  page: number = 0,
  size: number = 10
): Promise<SubmissionsPageResponse> => {
  const token = getAccessToken();
  const response = await axios.get<SubmissionsPageResponse>(
    `${BASE_URL}/contests/${contestId}/submissions`,
    {
      params: { page, size },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );
  return response.data;
};
