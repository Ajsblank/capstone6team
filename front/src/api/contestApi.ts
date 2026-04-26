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
  targetAudience: string;
  description: string;
  certification: boolean;
  timeLimitSec: number;
  memoryLimitMb: number;
  exampleCode: File;
  judgeCode: File;
  visualizationHtml: File;
  soloPlayHtml?: File;
  problemMd: File;
  startDate: string;
  endDate: string;
  maxParticipants: number;
}

export const createContest = async (data: CreateContestData): Promise<void> => {
  const fd = new FormData();
  fd.append("title", data.title);
  fd.append("description", data.description);
  fd.append("certification", String(data.certification));
  fd.append("timeLimitSec", String(data.timeLimitSec));
  fd.append("memoryLimitMb", String(data.memoryLimitMb));
  fd.append("exampleCode", data.exampleCode);
  fd.append("judgeCode", data.judgeCode);
  fd.append("visualizationHtml", data.visualizationHtml);
  if (data.soloPlayHtml) fd.append("soloPlayHtml", data.soloPlayHtml);
  fd.append("problemMd", data.problemMd);
  fd.append("startDate", data.startDate);
  fd.append("endDate", data.endDate);
  fd.append("maxParticipants", String(data.maxParticipants));
  fd.append("status", "PLANNED");
  fd.append("targetAudience", data.targetAudience);

  await api.post("/contests/create", fd);
};
