import axios from "axios";
import { getAccessToken, applyAuthInterceptor } from "./authApi";

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

export interface CreateContestData {
  title: string;
  description: string;
  certification: boolean;
  timeLimitSec: number;
  memoryLimitMb: number;
  sampleCode: File;           // 참가자 예시 코드 (구 exampleCode)
  judgeCode: File;
  exampleAiCodes: File[];     // 참가자 코드가 대결할 예시 AI 코드 목록
  visualizationHtml: File | null;  // 비인증 시 선택, 인증 시 필수
  soloPlayHtml: File | null;       // 비인증 시 선택, 인증 시 필수
  status: ContestStatus;
  startDate: string;
  endDate: string;
  maxParticipants: number;
  creatorId: number;
}

export type ContestStatus = "TEST" | "PLANNED" | "RUNNING" | "PAUSED" | "END";

export interface ContestResponse {
  id: number;
  status: ContestStatus;
  createdAt: string;
}

export interface PatchContestData {
  title?: string;
  description?: string;
  certification?: boolean;
  timeLimitSec?: number;
  memoryLimitMb?: number;
  judgeCode?: string;
  sampleCode?: string;
  status?: ContestStatus;
  startDate?: string;
  endDate?: string;
  maxParticipants?: number;
}

export const patchContest = async (contestId: number, data: PatchContestData): Promise<void> => {
  await api.patch(`/api/contests/${contestId}`, data);
};

const htmlToText = (html: string): string => {
  const el = document.createElement("div");
  el.innerHTML = html;
  return (el.textContent ?? el.innerText ?? "").trim();
};

// ── 비인증 대회 생성 — POST /api/contests/create/uncertified ──
export const createContest = async (data: CreateContestData): Promise<ContestResponse> => {
  const [sampleCode, judgeCode] = await Promise.all([
    data.sampleCode.text(),
    data.judgeCode.text(),
  ]);
  const exampleAiCodes = await Promise.all(data.exampleAiCodes.map(f => f.text()));
  const visualizationHtml = data.visualizationHtml ? await data.visualizationHtml.text() : undefined;
  const soloPlayHtml      = data.soloPlayHtml      ? await data.soloPlayHtml.text()      : undefined;

  const { data: res } = await api.post<ContestResponse>("/api/contests/create/uncertified", {
    title:           data.title,
    description:     htmlToText(data.description),
    certification:   data.certification,
    timeLimitSec:    data.timeLimitSec,
    memoryLimitMb:   data.memoryLimitMb,
    status:          data.status,
    startDate:       data.startDate ? data.startDate.replace("T", " ").slice(0, 16) : undefined,
    endDate:         data.endDate   ? data.endDate.replace("T", " ").slice(0, 16)   : undefined,
    maxParticipants: data.maxParticipants,
    creatorId:       data.creatorId,
    sampleCode,
    judgeCode,
    exampleAiCodes,
    visualizationHtml,
    soloPlayHtml,
  });
  return res;
};

// ── 인증 대회 생성 — POST /api/contests/create/certified ──
export const createCertifiedContest = async (
  data: CreateContestData,
  reviewerEmails: string[]
): Promise<ContestResponse> => {
  const [sampleCode, judgeCode] = await Promise.all([
    data.sampleCode.text(),
    data.judgeCode.text(),
  ]);
  const exampleAiCodes    = await Promise.all(data.exampleAiCodes.map(f => f.text()));
  const visualizationHtml = data.visualizationHtml ? await data.visualizationHtml.text() : undefined;
  const soloPlayHtml      = data.soloPlayHtml      ? await data.soloPlayHtml.text()      : undefined;

  const { data: res } = await api.post<ContestResponse>("/api/contests/create/certified", {
    title:           data.title,
    description:     htmlToText(data.description),
    certification:   data.certification,
    timeLimitSec:    data.timeLimitSec,
    memoryLimitMb:   data.memoryLimitMb,
    status:          data.status,
    startDate:       data.startDate ? data.startDate.replace("T", " ").slice(0, 16) : undefined,
    endDate:         data.endDate   ? data.endDate.replace("T", " ").slice(0, 16)   : undefined,
    maxParticipants: data.maxParticipants,
    creatorId:       data.creatorId,
    sampleCode,
    judgeCode,
    exampleAiCodes,
    visualizationHtml,
    soloPlayHtml,
    reviewerEmails,
  });
  return res;
};
