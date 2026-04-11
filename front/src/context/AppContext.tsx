import React, { createContext, useContext, useState, useMemo, useCallback } from "react";

export type Page =
  | "home"
  | "login"
  | "signup"
  | "submit"
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

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPage, setCurrentPage] = useState<Page>("home");
  const [user, setUser] = useState<User | null>(null);

  const navigate = useCallback((page: Page) => setCurrentPage(page), []);
  const login = useCallback((u: User) => setUser(u), []);
  const logout = useCallback(() => setUser(null), []);

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
