import React, { useState } from "react";
import AppHeader from "../components/AppHeader";
import "./AppLayout.css";

type HomeTab = "home" | "contest" | "help";

const AlgoHomePage: React.FC = () => {
const [activeTab, setActiveTab] = useState<HomeTab>("home");

  return (
    <div className="home-page">
      <AppHeader
        activePage={activeTab === "home" ? "home" : activeTab === "contest" ? "contest" : "help"}
        onHomeClick={() => setActiveTab("home")}
        onContestClick={() => setActiveTab("contest")}
        onHelpClick={() => setActiveTab("help")}
      />

      <main className="home-body">
        {activeTab === "home" && (
          <div className="home-content">
            <div className="home-hero">
              <h1 className="home-hero-title">알고리즘 문제</h1>
            </div>
          </div>
        )}

        {activeTab === "contest" && (
          <div className="home-placeholder">
            <span className="home-placeholder-text">대회 — 준비 중입니다.</span>
          </div>
        )}

        {activeTab === "help" && (
          <div className="home-placeholder">
            <span className="home-placeholder-text">도움말 — 준비 중입니다.</span>
          </div>
        )}
      </main>
    </div>
  );
};

export default AlgoHomePage;
