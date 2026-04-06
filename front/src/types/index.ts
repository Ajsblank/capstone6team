export type Language = "python" | "java" | "cpp" | "javascript";

export interface Problem {
  id: number;
  title: string;
  description: string;
  inputFormat: string;
  outputFormat: string;
  examples: { input: string; output: string }[];
  constraints: string[];
  timeLimit: number; // ms
  memoryLimit: number; // MB
}

export interface SubmitRequest {
  userId: string;
  language: string;
  sourceCode: string;
}

export interface SubmitResponse {
  success: boolean;
  message: string;
}
