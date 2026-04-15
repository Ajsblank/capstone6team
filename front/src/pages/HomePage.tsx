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
            className="home-tab-btn"
            onClick={() => navigate("problems")}
          >
            문제
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
          <button
            className="home-auth-btn home-auth-btn--battle"
            onClick={() => navigate("submit")}
          >
            ⚔️ 코드 배틀로
          </button>
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
              <p className="home-hero-sub">
                백준의 정신을 이어받아, 알고리즘 문제를 풀 수 있는 사이트
              </p>
              <p className="home-hero-desc">
                백바오야 가지마...<br />                
              </p>
              <button className="home-cta-btn" onClick={() => navigate("problems")}>
                문제 풀러 가기
              </button>
            </div>
            <div className="home-cards">
              <div className="home-card">
                <div className="home-card-icon">📝</div>
                <h3 className="home-card-title">문제 풀기</h3>
                <p className="home-card-desc">백준에서 영감을 받은 다양한 난이도의 문제를 풀고 실력을 키우세요.</p>
              </div>
              <div className="home-card">
                <div className="home-card-icon">⚔️</div>
                <h3 className="home-card-title">AI 배틀</h3>
                <p className="home-card-desc">내가 짠 AI 코드를 제출하면 다른 참가자의 AI와 자동으로 대결합니다.</p>
              </div>
              <div className="home-card">
                <div className="home-card-icon">🏆</div>
                <h3 className="home-card-title">순위 경쟁</h3>
                <p className="home-card-desc">리더보드에서 전국 참가자들과 순위를 겨루고 최강자를 가리세요.</p>
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
