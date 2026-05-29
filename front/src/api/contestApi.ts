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

// ── 파일 확장자 → 언어 코드 ──────────────────────────────────────────────────
export function extToLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    cpp: "CPP", cc: "CPP", cxx: "CPP", c: "CPP",
    java: "JAVA",
    py: "PYTHON",
    js: "JAVASCRIPT",
    ts: "TYPESCRIPT",
    cs: "CSHARP",
    go: "GO",
    rs: "RUST",
    kt: "KOTLIN",
    lua: "LUA",
  };
  return map[ext] ?? ext.toUpperCase();
}

// ── 예시 AI 코드 항목 (파일 + 설명) ─────────────────────────────────────────
export interface AiCodeEntry {
  file: File;
  description: string;
}

export interface CreateContestData {
  title: string;
  description: string;
  certification: boolean;
  timeLimitSec: number;
  memoryLimitMb: number;
  sampleCodes: File[];                  // 여러 샘플 코드
  judgeCode: File;
  exampleAiCodes: AiCodeEntry[];        // 파일 + 설명
  visualizationHtml: File | null;
  soloPlayHtml: File | null;
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

export interface ModifyContestData {
  title: string;
  description: string;
  timeLimitSec: number;
  memoryLimitMb: number;
  sampleCode?: File | null;
  judgeCode?: File | null;
  exampleAiCodes?: File[];
  visualizationHtml?: File | null;
  soloPlayHtml?: File | null;
  startDate: string;
  endDate: string;
  maxParticipants: number;
}

async function buildModifyBody(data: ModifyContestData) {
  const sampleCode        = data.sampleCode        ? await data.sampleCode.text()        : undefined;
  const judgeCode         = data.judgeCode         ? await data.judgeCode.text()         : undefined;
  const exampleAiCodes    = data.exampleAiCodes && data.exampleAiCodes.length > 0
    ? await Promise.all(data.exampleAiCodes.map(f => f.text())) : undefined;
  const visualizationHtml = data.visualizationHtml ? await data.visualizationHtml.text() : undefined;
  const soloPlayHtml      = data.soloPlayHtml      ? await data.soloPlayHtml.text()      : undefined;
  return {
    title:           data.title,
    description:     data.description,
    timeLimitSec:    data.timeLimitSec,
    memoryLimitMb:   data.memoryLimitMb,
    startDate:       data.startDate ? data.startDate.replace("T", " ").slice(0, 16) : undefined,
    endDate:         data.endDate   ? data.endDate.replace("T", " ").slice(0, 16)   : undefined,
    maxParticipants: data.maxParticipants,
    ...(sampleCode        !== undefined && { sampleCode }),
    ...(judgeCode         !== undefined && { judgeCode }),
    ...(exampleAiCodes    !== undefined && { exampleAiCodes }),
    ...(visualizationHtml !== undefined && { visualizationHtml }),
    ...(soloPlayHtml      !== undefined && { soloPlayHtml }),
  };
}

export const modifyContest = async (contestId: number, data: ModifyContestData): Promise<void> => {
  await api.patch(`/api/contests/${contestId}/modify/uncertified`, await buildModifyBody(data));
};

export const modifyCertifiedContest = async (contestId: number, data: ModifyContestData): Promise<void> => {
  await api.patch(`/api/contests/${contestId}/modify/certified`, await buildModifyBody(data));
};

// ── 비인증 대회 생성 — POST /api/contests/create/uncertified ──
export const createContest = async (data: CreateContestData): Promise<ContestResponse> => {
  const sampleCodes = await Promise.all(
    data.sampleCodes.map(async f => ({
      code: await f.text(),
      language: extToLanguage(f.name),
    }))
  );
  const judgeCode = await data.judgeCode.text();
  const exampleAiCodes = await Promise.all(
    data.exampleAiCodes.map(async ({ file, description }) => ({
      code: await file.text(),
      description,
      language: extToLanguage(file.name),
    }))
  );
  const visualizationHtml = data.visualizationHtml ? await data.visualizationHtml.text() : undefined;
  const soloPlayHtml      = data.soloPlayHtml      ? await data.soloPlayHtml.text()      : undefined;

  const { data: res } = await api.post<ContestResponse>("/api/contests/create/uncertified", {
    title:           data.title,
    description:     data.description,
    certification:   data.certification,
    timeLimitSec:    data.timeLimitSec,
    memoryLimitMb:   data.memoryLimitMb,
    status:          data.status,
    startDate:       data.startDate ? data.startDate.replace("T", " ").slice(0, 16) : undefined,
    endDate:         data.endDate   ? data.endDate.replace("T", " ").slice(0, 16)   : undefined,
    maxParticipants: data.maxParticipants,
    creatorId:       data.creatorId,
    sampleCodes,
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
  const sampleCodes = await Promise.all(
    data.sampleCodes.map(async f => ({
      code: await f.text(),
      language: extToLanguage(f.name),
    }))
  );
  const judgeCode = await data.judgeCode.text();
  const exampleAiCodes = await Promise.all(
    data.exampleAiCodes.map(async ({ file, description }) => ({
      code: await file.text(),
      description,
      language: extToLanguage(file.name),
    }))
  );
  const visualizationHtml = data.visualizationHtml ? await data.visualizationHtml.text() : undefined;
  const soloPlayHtml      = data.soloPlayHtml      ? await data.soloPlayHtml.text()      : undefined;

  const { data: res } = await api.post<ContestResponse>("/api/contests/create/certified", {
    title:           data.title,
    description:     data.description,
    certification:   data.certification,
    timeLimitSec:    data.timeLimitSec,
    memoryLimitMb:   data.memoryLimitMb,
    status:          data.status,
    startDate:       data.startDate ? data.startDate.replace("T", " ").slice(0, 16) : undefined,
    endDate:         data.endDate   ? data.endDate.replace("T", " ").slice(0, 16)   : undefined,
    maxParticipants: data.maxParticipants,
    creatorId:       data.creatorId,
    sampleCodes,
    judgeCode,
    exampleAiCodes,
    visualizationHtml,
    soloPlayHtml,
    reviewerEmails,
  });
  return res;
};
