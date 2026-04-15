import React from "react";
import { AppProvider, useApp } from "./context/AppContext";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import SubmitPage from "./pages/SubmitPage";
import ProblemsPage from "./pages/ProblemsPage";
import CreateProblemPage from "./pages/CreateProblemPage";
import ProfilePage from "./pages/ProfilePage";
import AccountSettingsPage from "./pages/AccountSettingsPage";

const DevApiBadge: React.FC = () => (
  <div style={{
    position: "fixed", bottom: "12px", right: "12px",
    background: "rgba(0,0,0,0.7)", color: "#89b4fa",
    fontSize: "11px", padding: "4px 10px", borderRadius: "4px",
    fontFamily: "monospace", zIndex: 9999, pointerEvents: "none",
    userSelect: "none",
  }}>
    API: {process.env.REACT_APP_API_BASE_URL || "(not set)"}
  </div>
);

const PageRouter: React.FC = () => {
  const { currentPage } = useApp();

  switch (currentPage) {
    case "home":             return <HomePage />;
    case "login":            return <LoginPage />;
    case "signup":           return <SignUpPage />;
    case "submit":           return <SubmitPage />;
    case "problems":         return <ProblemsPage />;
    case "create-problem":   return <CreateProblemPage />;
    case "profile":          return <ProfilePage />;
    case "account-settings": return <AccountSettingsPage />;
    default:                 return <HomePage />;
  }
};

function App() {
  return (
    <AppProvider>
      <PageRouter />
      <DevApiBadge />
    </AppProvider>
  );
}

export default App;
