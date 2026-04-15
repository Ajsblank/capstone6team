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
    </AppProvider>
  );
}

export default App;
