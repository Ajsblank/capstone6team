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
              <p className="home-hero-sub">
                백준의 정신을 이어받아, 알고리즘 문제를 풀 수 있는 사이트
              </p>
              <p className="home-hero-desc">
                백바오야 가지마...<br />
              </p>
            </div>
            <p className="home-site-desc">
              알고리즘 문제를 <strong>자유롭게</strong> 올리고 풀어보세요~
            </p>
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
