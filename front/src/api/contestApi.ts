import axios from "axios";
import { getAccessToken } from "./authApi";

const BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

export type ContestStatus = "TEST" | "PLANNED" | "RUNNING" | "PAUSED" | "END";

export interface CreateContestData {
  title: string;
  description: string;
  certification: boolean;
  timeLimitSec: number;
  memoryLimitMb: number;
  exampleCode: File;
  judgeCode: File;
  visualizationHtml: File;       // ContestResourceRequest → S3 업로드 후 URL 저장
  soloPlayHtml?: File;           // ContestResourceRequest → S3 업로드 후 URL 저장 (선택)
  status: ContestStatus;
  startDate: string;             // datetime-local 형식 (yyyy-MM-ddTHH:mm), TEST 상태면 빈 문자열 허용
  endDate: string;
  maxParticipants: number;
}

export interface ContestResponse {
  id: number;
  status: ContestStatus;
  createdAt: string;        // ISO 8601 (백엔드 필드명: created_at)
  // updatedAt: string      // 백엔드 응답에 있으나 현재 미사용
}

export const createContest = async (data: CreateContestData): Promise<ContestResponse> => {
  const [exampleCode, judgeCode, visualizationHtml, soloPlayHtml] = await Promise.all([
    data.exampleCode.text(),
    data.judgeCode.text(),
    data.visualizationHtml.text(),
    data.soloPlayHtml ? data.soloPlayHtml.text() : Promise.resolve(undefined),
  ]);

  const { data: res } = await api.post<ContestResponse>("/api/contests/create", {
    title:            data.title,
    description:      data.description,
    certification:    data.certification,
    timeLimitSec:     data.timeLimitSec,
    memoryLimitMb:    data.memoryLimitMb,
    judgeCode:        judgeCode,
    exampleCode:      exampleCode,
    visualizationHtml,
    ...(soloPlayHtml !== undefined ? { soloPlayHtml } : {}),
    status:           data.status,
    ...(data.startDate ? { startDate: data.startDate.replace("T", " ") } : {}),
    ...(data.endDate   ? { endDate:   data.endDate.replace("T", " ")   } : {}),
    maxParticipants:  data.maxParticipants,
  });
  return res;
};
