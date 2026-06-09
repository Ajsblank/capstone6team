import axios, { AxiosInstance } from "axios";

const BASE_URL = process.env.REACT_APP_API_BASE_URL || "";

const api = axios.create({ baseURL: BASE_URL });

// ──────────────────────────────────────────
// 토큰 / 사용자 정보 관리
// ──────────────────────────────────────────
let accessToken: string | null = localStorage.getItem("accessToken");
let userId:      string | null = localStorage.getItem("userId");
let username:    string | null = localStorage.getItem("username");

if (accessToken) {
  api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;
}

export const getAccessToken = () => accessToken;
export const getUserId      = () => userId;
export const getUsername    = () => username;

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

export const setUserId = (id: string | null) => {
  userId = id;
  if (id) localStorage.setItem("userId", id);
  else    localStorage.removeItem("userId");
};

export const setUsername = (name: string | null) => {
  username = name;
  if (name) localStorage.setItem("username", name);
  else      localStorage.removeItem("username");
};

export const saveRefreshToken = (token: string) =>
  localStorage.setItem("refreshToken", token);

export const getRefreshToken = () =>
  localStorage.getItem("refreshToken");

// 세션 식별자 — 로그인 응답(LoginResponse.sessionId)에서 받아 보관, 로그아웃 시 X-Session-Id로 전송
export const setSessionId = (id: string | null) => {
  if (id) localStorage.setItem("sessionId", id);
  else    localStorage.removeItem("sessionId");
};
export const getSessionId = () => localStorage.getItem("sessionId");

export const clearTokens = () => {
  setAccessToken(null);
  setUserId(null);
  setUsername(null);
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("sessionId");
};

// ──────────────────────────────────────────
// 401 자동 토큰 갱신 인터셉터
// 모든 인증이 필요한 axios 인스턴스에 적용
// ──────────────────────────────────────────
let isRefreshing = false;
let pendingQueue: Array<(token: string) => void> = [];

export const applyAuthInterceptor = (instance: AxiosInstance): void => {
  instance.interceptors.response.use(
    res => res,
    async (error) => {
      const original = error.config;
      if (error.response?.status !== 401 || original._retry) {
        return Promise.reject(error);
      }
      original._retry = true;

      if (isRefreshing) {
        return new Promise(resolve => {
          pendingQueue.push(token => {
            original.headers["Authorization"] = `Bearer ${token}`;
            resolve(instance(original));
          });
        });
      }

      isRefreshing = true;
      try {
        const newToken = await refreshTokenApi();
        pendingQueue.forEach(cb => cb(newToken));
        pendingQueue = [];
        original.headers["Authorization"] = `Bearer ${newToken}`;
        return instance(original);
      } catch {
        pendingQueue = [];
        logoutApi().catch(() => {});
        window.dispatchEvent(new CustomEvent("auth:logout"));
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }
  );
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
  userId: string;
  sessionId?: string;
  joinedContests?: number[];
  hostedContests?: number[];
  createdContests?: number[];
}

// ──────────────────────────────────────────
// API
// ──────────────────────────────────────────

export const signUp = async (body: SignUpRequest): Promise<void> => {
  await api.post("/api/auth/signup", body);
};

export const resendVerificationEmail = async (email: string): Promise<void> => {
  await api.post("/api/auth/mail/send", { email });
};

export const verifyEmailCode = async (email: string, code: string): Promise<void> => {
  await api.post("/api/auth/mail", { email, code });
};

export const loginApi = async (body: LoginRequest): Promise<TokenResponse> => {
  const { data } = await api.post<TokenResponse>("/api/auth/login", body);
  setAccessToken(data.accessToken);
  saveRefreshToken(data.refreshToken);
  setUserId(data.userId);
  setSessionId(data.sessionId ?? null);   // 백엔드가 발급한 세션 ID 보관(로그아웃 시 사용)
  return data;
};

export const logoutApi = async (): Promise<void> => {
  const sessionId = getSessionId();
  // 백엔드 /logout 은 Authorization(자동 첨부) + X-Session-Id 헤더로 현재 세션을 무효화 (body 미사용)
  if (sessionId) {
    await api.post("/api/auth/logout", null, {
      headers: { "X-Session-Id": sessionId },
    }).catch(() => {});
  }
  clearTokens();
};

export const refreshTokenApi = async (): Promise<string> => {
  const refreshToken = getRefreshToken();
  const { data } = await api.post<TokenResponse>("/api/auth/refresh", { refreshToken });
  setAccessToken(data.accessToken);
  saveRefreshToken(data.refreshToken);
  if (data.sessionId) setSessionId(data.sessionId);   // 회전된 세션 ID가 오면 갱신, 없으면 기존 유지
  return data.accessToken;
};

export const signOutApi = async (password: string): Promise<void> => {
  await api.patch("/api/auth/signout", { password });
  clearTokens();
};
