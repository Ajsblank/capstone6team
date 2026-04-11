import React, { createContext, useContext, useState } from "react";

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

  const navigate = (page: Page) => setCurrentPage(page);
  const login = (u: User) => setUser(u);
  const logout = () => setUser(null);

  return (
    <AppContext.Provider value={{ currentPage, navigate, user, login, logout }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextValue => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
};
