import axios from "axios";

const BASE_URL = process.env.REACT_APP_API_BASE_URL || "";

const api = axios.create({ baseURL: BASE_URL });

// ──────────────────────────────────────────
// 토큰 관리
// ──────────────────────────────────────────
let accessToken: string | null = localStorage.getItem("accessToken");

// 앱 시작 시 저장된 토큰을 axios 헤더에 복원
if (accessToken) {
  api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;
}

export const getAccessToken = () => accessToken;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
  if (token) {
    localStorage.setItem("accessToken", token);
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    localStorage.removeItem("accessToken");
    delete api.defaults.headers.common["Authorization"];
  }
};

export const saveRefreshToken = (token: string) =>
  localStorage.setItem("refreshToken", token);

export const getRefreshToken = () =>
  localStorage.getItem("refreshToken");

export const clearTokens = () => {
  setAccessToken(null);
  localStorage.removeItem("refreshToken");
};

// ──────────────────────────────────────────
// 타입
// ──────────────────────────────────────────
export interface SignUpRequest {
  email: string;
  password: string;
  nickname: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

// ──────────────────────────────────────────
// API
// ──────────────────────────────────────────

// 회원가입
export const signUp = async (body: SignUpRequest): Promise<void> => {
  await api.post("/api/auth/signup", body);
};

// 이메일 인증번호 재발송 (TODO: 백엔드 재발송 전용 엔드포인트 확인 후 수정)
export const resendVerificationEmail = async (email: string): Promise<void> => {
  await api.post("/api/auth/mail/send", { email });
};

// 이메일 인증번호 확인
export const verifyEmailCode = async (email: string, code: string): Promise<void> => {
  await api.post("/api/auth/mail", { email, code });
};

// 로그인 → JWT 토큰 저장
export const loginApi = async (body: LoginRequest): Promise<TokenResponse> => {
  const { data } = await api.post<TokenResponse | string>("/api/auth/login", body);
  // 백엔드가 raw 문자열로 토큰을 반환하는 경우 처리
  if (typeof data === "string") {
    setAccessToken(data);
    return { accessToken: data, refreshToken: "" };
  }
  setAccessToken(data.accessToken);
  saveRefreshToken(data.refreshToken);
  return data;
};

// 로그아웃
export const logoutApi = async (): Promise<void> => {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    await api.post("/api/auth/logout", { refreshToken }).catch(() => {});
  }
  clearTokens();
};

// 토큰 갱신
export const refreshTokenApi = async (): Promise<string> => {
  const refreshToken = getRefreshToken();
  const { data } = await api.post<TokenResponse>("/api/auth/refresh", { refreshToken });
  setAccessToken(data.accessToken);
  saveRefreshToken(data.refreshToken);
  return data.accessToken;
};

// 회원탈퇴
export const signOutApi = async (password: string): Promise<void> => {
  await api.patch("/api/auth/signout", { password });
  clearTokens();
};
