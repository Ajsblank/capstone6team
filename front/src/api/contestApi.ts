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
  soloPlayHtml?: File;
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
      data.soloPlayHtml ? data.soloPlayHtml.text() : Promise.resolve(undefined),
    ]);

  const { data: res } = await api.post<ContestResponse>("/api/contests/create", {
    title:            data.title,
    description:      data.description,
    certification:    data.certification,
    timeLimitSec:     data.timeLimitSec,
    memoryLimitMb:    data.memoryLimitMb,
    startDate:        data.startDate,
    endDate:          data.endDate,
    maxParticipants:  data.maxParticipants,
    exampleCode,
    // 백엔드 ContestResponse에서 주석 처리됨
    judgeCode,
    // 백엔드 CreateContestRequest 필드 확인 필요
    visualizationHtml,
    ...(soloPlayHtml !== undefined && { soloPlayHtml }),
  });
  return res;
};
