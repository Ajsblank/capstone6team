import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef } from "react";
import { logoutApi, getAccessToken, getUserId, getUsername, refreshTokenApi } from "../api/authApi";
import { ensureSseConnected, unsubscribeFromResults } from "../api/sseApi";
import { clearMyProfileCache } from "../components/ProfileBadge";

export type Page =
  | "landing"
  | "home"
  | "login"
  | "signup"
  | "battle"
  | "submit"
  | "problems"
  | "problem-detail"
  | "create-problem"
  | "create-contest"
  | "create-certified-contest"
  | "contest-settings"
  | "tournament"
  | "tutorial-contest"
  | "profile";

export interface User {
  id: string;
  username: string;
  email?: string;
  school?: string;
}

interface AppContextValue {
  currentPage: Page;
  navigate: (page: Page) => void;
  user: User | null;
  login: (user: User, joinedContests?: number[], hostedContests?: number[], createdContests?: number[]) => void;
  logout: () => void;
  joinedContestIds: number[];
  hostedContestIds: number[];
  createdContestIds: number[];
  addJoinedContest:  (contestId: number) => void;
  addCreatedContest: (contestId: number) => void;
}

const VALID_PAGES: Page[] = ["landing", "home", "login", "signup", "battle", "submit", "problems", "problem-detail", "create-problem", "create-contest", "create-certified-contest", "contest-settings", "tournament", "tutorial-contest", "profile"];

function getPageFromHash(): Page {
  const hash = window.location.hash.replace("#", "").split("/")[0] as Page;
  return VALID_PAGES.includes(hash) ? hash : "landing";
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPage, setCurrentPage] = useState<Page>(getPageFromHash);
  const [joinedContestIds, setJoinedContestIds] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem("joinedContests") ?? "[]"); } catch { return []; }
  });
  const [hostedContestIds, setHostedContestIds] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem("hostedContests") ?? "[]"); } catch { return []; }
  });
  const [createdContestIds, setCreatedContestIds] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem("createdContests") ?? "[]"); } catch { return []; }
  });

  const [user, setUser] = useState<User | null>(() => {
    const token = getAccessToken();
    const uid   = getUserId();
    const uname = getUsername();
    if (token && uid) return { id: uid, username: uname ?? uid, email: uname ?? "" };
    return null;
  });

  // 브라우저 뒤로가기/앞으로가기 지원
  // ref를 통해 항상 최신 getPageFromHash를 호출 (HMR 클로저 문제 방지)
  const getPageRef = useRef(getPageFromHash);
  useEffect(() => { getPageRef.current = getPageFromHash; });

  useEffect(() => {
    const handleHashChange = () => setCurrentPage(getPageRef.current());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigate = useCallback((page: Page) => {
    window.location.hash = page;
    setCurrentPage(page);
  }, []);

  // 로그인/페이지 새로고침 시 SSE 재연결, 로그아웃 시 해제
  useEffect(() => {
    if (user?.id) {
      console.log("[AppContext] ========== SSE 연결 시작 ==========");
      console.log("[AppContext] 사용자 로그인 감지:", {
        userId: user.id,
        username: user.username,
        timestamp: new Date().toLocaleTimeString()
      });
      console.log("[AppContext] ensureSseConnected() 호출 → /api/subscribe/{userId} 연결 시도");
      ensureSseConnected(user.id);
    } else {
      console.log("[AppContext] ========== SSE 연결 해제 ==========");
      console.log("[AppContext] 로그아웃 감지 → SSE 연결 종료");
      setJoinedContestIds([]);
      setHostedContestIds([]);
      setCreatedContestIds([]);
      localStorage.removeItem("joinedContests");
      localStorage.removeItem("hostedContests");
      localStorage.removeItem("createdContests");
      unsubscribeFromResults();
    }
  }, [user?.id]);

  // 토큰 갱신 실패 시 강제 로그아웃
  useEffect(() => {
    const handleForceLogout = () => {
      clearMyProfileCache();
      setUser(null);
      window.location.hash = "login";
      setCurrentPage("login");
    };
    window.addEventListener("auth:logout", handleForceLogout);
    return () => window.removeEventListener("auth:logout", handleForceLogout);
  }, []);

  // 새로고침/초기 진입 시 현재 토큰 로그 + 만료 여부 확인
  useEffect(() => {
    const access  = getAccessToken();
    const refresh = localStorage.getItem("refreshToken");
    console.log("[Auth] 새로고침/진입 — accessToken:", access);
    console.log("[Auth] 새로고침/진입 — refreshToken:", refresh);

    if (!access || !user) return;

    try {
      const payload = JSON.parse(atob(access.split('.')[1]));
      const isExpired = Date.now() >= payload.exp * 1000;
      console.log("[Auth] accessToken 만료 여부:", isExpired, "| exp:", new Date(payload.exp * 1000).toLocaleString());

      if (isExpired) {
        console.warn("[Auth] accessToken 만료 → refreshTokenApi 호출");
        refreshTokenApi().catch(async (err) => {
          console.warn("[Auth] refreshTokenApi 실패:", err?.response?.status, err?.message);
          await logoutApi().catch(() => {});
          window.dispatchEvent(new CustomEvent("auth:logout"));
        });
      }
    } catch (e) {
      console.warn("[Auth] accessToken 디코딩 실패:", e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 탭 복귀 시 토큰 만료 여부 선제적 감지
  useEffect(() => {
    const checkOnFocus = async () => {
      if (document.hidden) return;
      const token = getAccessToken();
      console.log("[Auth] 탭 복귀 감지 — accessToken 존재 여부:", !!token, "| user:", !!user);
      if (!token && user) {
        console.warn("[Auth] 토큰 없음 + user 있음 → 강제 로그아웃");
        clearMyProfileCache();
        setUser(null);
        window.location.hash = "login";
        setCurrentPage("login");
        return;
      }
      if (token && user) {
        console.log("[Auth] refreshTokenApi 호출 (탭 복귀)");
        try {
          const newToken = await refreshTokenApi();
          console.log("[Auth] refreshTokenApi 성공 — 새 accessToken:", newToken);
        } catch (err: any) {
          console.warn("[Auth] refreshTokenApi 실패 (탭 복귀):", err?.response?.status, err?.message);
          await logoutApi().catch(() => {});
          window.dispatchEvent(new CustomEvent("auth:logout"));
        }
      }
    };
    document.addEventListener("visibilitychange", checkOnFocus);
    return () => document.removeEventListener("visibilitychange", checkOnFocus);
  }, [user]);

  const login = useCallback((u: User, joinedContests: number[] = [], hostedContests: number[] = [], createdContests: number[] = []) => {
    clearMyProfileCache();   // 이전 계정 프로필 캐시 제거 → 새 계정 정보로 재조회
    setUser(u);
    setJoinedContestIds(joinedContests);
    setHostedContestIds(hostedContests);
    setCreatedContestIds(createdContests);
    localStorage.setItem("joinedContests", JSON.stringify(joinedContests));
    localStorage.setItem("hostedContests", JSON.stringify(hostedContests));
    localStorage.setItem("createdContests", JSON.stringify(createdContests));
  }, []);

  const addJoinedContest = useCallback((contestId: number) => {
    setJoinedContestIds(prev => {
      if (prev.includes(contestId)) return prev;
      const next = [...prev, contestId];
      localStorage.setItem("joinedContests", JSON.stringify(next));
      return next;
    });
  }, []);

  const addCreatedContest = useCallback((contestId: number) => {
    setCreatedContestIds(prev => {
      if (prev.includes(contestId)) return prev;
      const next = [...prev, contestId];
      localStorage.setItem("createdContests", JSON.stringify(next));
      return next;
    });
  }, []);

  const logout = useCallback(async () => {
    await logoutApi();
    clearMyProfileCache();   // 로그아웃 시 프로필 캐시 제거 (다음 계정에 잔존 방지)
    setUser(null);
    setJoinedContestIds([]);
    setHostedContestIds([]);
    setCreatedContestIds([]);
    localStorage.removeItem("joinedContests");
    localStorage.removeItem("hostedContests");
    localStorage.removeItem("createdContests");
    window.location.hash = "landing";
    setCurrentPage("landing");
  }, []);

  const value = useMemo(
    () => ({ currentPage, navigate, user, login, logout, joinedContestIds, hostedContestIds, createdContestIds, addJoinedContest, addCreatedContest }),
    [currentPage, user, navigate, login, logout, joinedContestIds, hostedContestIds, createdContestIds, addJoinedContest, addCreatedContest]
  );

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextValue => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
};
