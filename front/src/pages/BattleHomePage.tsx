import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import "./AppLayout.css";
import "./BattleHomePage.css";

type BattleTab = "home" | "problems" | "contest" | "help";

// TODO: 백엔드 /api/battle/problems 연동 시 교체
const BATTLE_PROBLEMS = [
  {
    id: 1,
    title: "치토 배틀",
    description: "AI 코드를 제출하여 상대방의 치토와 배틀을 펼치세요.",
    difficulty: "일반",
  },
];

const BattlePage: React.FC = () => {
  const { user, logout, navigate } = useApp();
  const [activeTab, setActiveTab] = useState<BattleTab>("home");

  return (
    <div className="home-page battle-home-page">
      <header className="home-header">
        <span className="home-logo" onClick={() => navigate("landing")}>ASAP 캡스톤</span>
        <nav className="home-tab-nav">
          <button
            className={`home-tab-btn${activeTab === "home" ? " home-tab-btn--active" : ""}`}
            onClick={() => setActiveTab("home")}
          >
            홈
          </button>
          <button
            className={`home-tab-btn${activeTab === "problems" ? " home-tab-btn--active" : ""}`}
            onClick={() => setActiveTab("problems")}
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
            className="home-auth-btn home-auth-btn--ghost"
            onClick={() => navigate("landing")}
          >
            홈
          </button>
          {user ? (
            <>
              <span className="home-username" onClick={() => navigate("profile")}>{user.username}</span>
              <button className="home-auth-btn home-auth-btn--secondary" onClick={() => navigate("account-settings")}>설정</button>
              <button className="home-auth-btn home-auth-btn--ghost" onClick={() => logout()}>로그아웃</button>
            </>
          ) : (
            <>
              <button className="home-auth-btn home-auth-btn--ghost" onClick={() => navigate("signup")}>회원가입</button>
              <button className="home-auth-btn home-auth-btn--primary" onClick={() => navigate("login")}>로그인</button>
            </>
          )}
        </div>
      </header>

      <main className="home-body">
        {/* 홈 탭 */}
        {activeTab === "home" && (
          <div className="home-content">
            <div className="home-hero">
              <h1 className="home-hero-title">코드 배틀</h1>
              <p className="home-hero-sub">AI 코드를 제출하고 상대방의 AI와 실시간으로 대결하세요</p>
            </div>
            <p className="home-site-desc">
              코드 배틀은 나만의 AI 코드를 작성해 다른 참가자의 AI와 자동으로 대결하는 플랫폼입니다.
              
            </p>
          </div>
        )}

        {/* 문제 탭 */}
        {activeTab === "problems" && (
          <div className="bp-problems">
            <h2 className="bp-problems-title">배틀 문제 목록</h2>
            <div className="bp-problem-list">
              {BATTLE_PROBLEMS.map((p) => (
                <div
                  key={p.id}
                  className="bp-problem-card"
                  onClick={() => { window.location.hash = `submit/${p.id}`; }}
                >
                  <div className="bp-problem-card-left">
                    <span className="bp-problem-num">#{p.id}</span>
                    <div>
                      <p className="bp-problem-title">{p.title}</p>
                      <p className="bp-problem-desc">{p.description}</p>
                    </div>
                  </div>
                  <div className="bp-problem-card-right">
                    <span className="bp-problem-difficulty">{p.difficulty}</span>
                    <span className="bp-problem-arrow">→</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 대회 탭 */}
        {activeTab === "contest" && (
          <div className="bp-contest">
            <div className="bp-contest-header">
              <h2 className="bp-contest-title">대회 목록</h2>
              <button
                className="bp-create-contest-btn"
                onClick={() => navigate("create-contest")}
              >
                + 대회 개최
              </button>
            </div>
            <div className="bp-contest-empty">
              <span className="bp-contest-empty-text">아직 등록된 대회가 없습니다.</span>
            </div>
          </div>
        )}

        {/* 도움말 탭 */}
        {activeTab === "help" && (
          <div className="home-placeholder">
            <span className="home-placeholder-text">도움말 — 준비 중입니다.</span>
          </div>
        )}
      </main>
    </div>
  );
};

export default BattlePage;
