import axios from "axios";
import { getAccessToken } from "./authApi";

const BASE_URL = process.env.REACT_APP_API_BASE_URL || "";

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

export interface TestCaseDto {
  input: string;
  output: string;
}

export interface CreateAlgorithmRequest {
  title: string;
  description: string;
  inputDescription: string;
  outputDescription: string;
  memoryLimitMB: number;
  timeLimitSec: number;
  exampleTestcases: TestCaseDto[];
  hiddenTestcases: TestCaseDto[];
}

// 백엔드 응답 (hiddenTestcases 제외)
export interface AlgorithmProblemResponse {
  id: number;
  title: string;
  description: string;
  inputDescription: string;
  outputDescription: string;
  memoryLimitMB: number;
  timeLimitSec: number;
  exampleTestcases: TestCaseDto[];
}

// 문제 생성 → 생성된 문제 정보 반환
export const createAlgorithm = async (body: CreateAlgorithmRequest): Promise<AlgorithmProblemResponse> => {
  const { data } = await api.post<AlgorithmProblemResponse>("/api/algorithms/create", body);
  return data;
};

// TODO: 백엔드 GET /api/algorithms/{id} 연동
export const getAlgorithm = async (id: number): Promise<AlgorithmProblemResponse> => {
  const { data } = await api.get<AlgorithmProblemResponse>(`/api/algorithms/${id}`);
  return data;
};

// TODO: 백엔드 GET /api/algorithms 목록 연동
export const getAlgorithmList = async (): Promise<AlgorithmProblemResponse[]> => {
  const { data } = await api.get<AlgorithmProblemResponse[]>("/api/algorithms");
  return data;
};
