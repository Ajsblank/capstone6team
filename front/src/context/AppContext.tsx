import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef } from "react";
import { logoutApi, getAccessToken, getUserId, getUsername } from "../api/authApi";
import { subscribeToResults, unsubscribeFromResults } from "../api/sseApi";

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
  | "profile"
  | "account-settings";

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
  login: (user: User) => void;
  logout: () => void;
}

const VALID_PAGES: Page[] = ["landing", "home", "login", "signup", "battle", "submit", "problems", "problem-detail", "create-problem", "create-contest", "profile", "account-settings"];

function getPageFromHash(): Page {
  const hash = window.location.hash.replace("#", "").split("/")[0] as Page;
  return VALID_PAGES.includes(hash) ? hash : "landing";
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPage, setCurrentPage] = useState<Page>(getPageFromHash);
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
      console.log("[AppContext] SSE 구독 — userId:", user.id);
      subscribeToResults(user.id, () => {});
    } else {
      unsubscribeFromResults();
    }
  }, [user?.id]);

  // 토큰 갱신 실패 시 강제 로그아웃
  useEffect(() => {
    const handleForceLogout = () => {
      setUser(null);
      window.location.hash = "login";
      setCurrentPage("login");
    };
    window.addEventListener("auth:logout", handleForceLogout);
    return () => window.removeEventListener("auth:logout", handleForceLogout);
  }, []);

  const login = useCallback((u: User) => setUser(u), []);
  const logout = useCallback(async () => {
    await logoutApi();
    setUser(null);
    window.location.hash = "landing";
    setCurrentPage("landing");
  }, []);

  const value = useMemo(
    () => ({ currentPage, navigate, user, login, logout }),
    [currentPage, user, navigate, login, logout]
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
