import React from "react";
import { AppProvider, useApp } from "./context/AppContext";
import AlgoHomePage from "./pages/AlgoHomePage";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import BattleHomePage from "./pages/BattleHomePage";
import BattleSubmitPage from "./pages/BattleSubmitPage";
import AlgoProblemListPage from "./pages/AlgoProblemListPage";
import AlgoCreateProblemPage from "./pages/AlgoCreateProblemPage";
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
    case "home":             return <AlgoHomePage />;
    case "login":            return <LoginPage />;
    case "signup":           return <SignUpPage />;
    case "battle":           return <BattleHomePage />;
    case "submit":           return <BattleSubmitPage />;
    case "problems":         return <AlgoProblemListPage />;
    case "create-problem":   return <AlgoCreateProblemPage />;
    case "profile":          return <ProfilePage />;
    case "account-settings": return <AccountSettingsPage />;
    default:                 return <AlgoHomePage />;
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
