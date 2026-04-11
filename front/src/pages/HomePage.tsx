import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import "./HomePage.css";

type HomeTab = "home" | "contest" | "help";

const HomePage: React.FC = () => {
  const { user, logout, navigate } = useApp();
  const [activeTab, setActiveTab] = useState<HomeTab>("home");

  return (
    <div className="home-page">
      <header className="home-header">
        <span className="home-logo" onClick={() => setActiveTab("home")}>
          CodeBattle
        </span>
        <nav className="home-tab-nav">
          <button
            className={`home-tab-btn${activeTab === "home" ? " home-tab-btn--active" : ""}`}
            onClick={() => setActiveTab("home")}
          >
            홈
          </button>
          <button
            className={`home-tab-btn${activeTab === "contest" ? " home-tab-btn--active" : ""}`}
            onClick={() => setActiveTab("contest")}
          >
            대회
          </button>
          <button
            className={`home-tab-btn${activeTab === "help" ? " home-tab-btn--active" : ""}`}
            onClick={() => setActiveTab("help")}
          >
            도움말
          </button>
        </nav>

        <div className="home-auth-area">
          {user ? (
            <>
              <span
                className="home-username"
                onClick={() => navigate("profile")}
                title="프로필 보기"
              >
                {user.username}
              </span>
              <button
                className="home-auth-btn home-auth-btn--secondary"
                onClick={() => navigate("account-settings")}
              >
                설정
              </button>
              <button
                className="home-auth-btn home-auth-btn--ghost"
                onClick={() => { logout(); }}
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <button
                className="home-auth-btn home-auth-btn--ghost"
                onClick={() => navigate("signup")}
              >
                회원가입
              </button>
              <button
                className="home-auth-btn home-auth-btn--primary"
                onClick={() => navigate("login")}
              >
                로그인
              </button>
            </>
          )}
        </div>
      </header>

      <main className="home-body">
        {activeTab === "home" && (
          <div className="home-content">
            <div className="home-hero">
              <h1 className="home-hero-title">CodeBattle</h1>
              <p className="home-hero-sub">알고리즘으로 승부하는 실시간 코드 배틀 플랫폼</p>
              <button
                className="home-cta-btn"
                onClick={() => navigate("submit")}
              >
                치토 배틀 
              </button>
            </div>
            <div className="home-cards">
              <div className="home-card">
                <div className="home-card-icon">⚔️</div>
                <h3 className="home-card-title">실시간 배틀</h3>
                <p className="home-card-desc">상대방과 실시간으로 코드를 제출하고 치토 배틀로 결과를 확인하세요.</p>
              </div>
              <div className="home-card">
                <div className="home-card-icon">📊</div>
                <h3 className="home-card-title">시각화</h3>
                <p className="home-card-desc">배틀 로그를 기반으로 전투 과정을 단계별로 시각화합니다.</p>
              </div>
              <div className="home-card">
                <div className="home-card-icon">🏆</div>
                <h3 className="home-card-title">리더보드</h3>
                <p className="home-card-desc">전국 참가자들과 실력을 겨루고 순위를 확인하세요.</p>
              </div>
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

export default HomePage;
