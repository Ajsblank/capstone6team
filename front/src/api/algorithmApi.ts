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

export const createAlgorithm = async (body: CreateAlgorithmRequest): Promise<void> => {
  await api.post("/api/algorithms", body);
};
