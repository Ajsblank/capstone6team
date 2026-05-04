import axios from "axios";
import { getAccessToken } from "./authApi";

const BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

export interface CreateContestData {
  title: string;
  description: string;   // problemMd 통합 — 텍스트 직접 입력 또는 파일 불러오기
  certification: boolean;
  timeLimitSec: number;
  memoryLimitMb: number;
  exampleCode: File;
  judgeCode: File;
  visualizationHtml: File;
  soloPlayHtml: File;
  status: ContestStatus;
  startDate: string;
  endDate: string;
  maxParticipants: number;
}

export type ContestStatus = "TEST" | "PLANNED" | "RUNNING" | "PAUSED" | "END";

export interface ContestResponse {
  id: number;
  status: ContestStatus;
  createdAt: string;        // ISO 8601
  // updatedAt: string      // 백엔드 응답에 있으나 현재 미사용
}

export const createContest = async (data: CreateContestData): Promise<ContestResponse> => {
  const [exampleCode, judgeCode, visualizationHtml, soloPlayHtml] =
    await Promise.all([
      data.exampleCode.text(),
      data.judgeCode.text(),
      data.visualizationHtml.text(),
      data.soloPlayHtml.text(),
    ]);

  const { data: res } = await api.post<ContestResponse>("/api/contests/create", {
    title:            data.title,
    description:      data.description,
    certification:    data.certification,
    timeLimitSec:     data.timeLimitSec,
    memoryLimitMb:    data.memoryLimitMb,
    status:           data.status,
    startDate:        data.startDate ? `${data.startDate} 00:00` : undefined,
    endDate:          data.endDate   ? `${data.endDate} 00:00`   : undefined,
    maxParticipants:  data.maxParticipants,
    exampleCode,
    judgeCode,
    visualizationHtml,
    soloPlayHtml,
  });
  return res;
};
