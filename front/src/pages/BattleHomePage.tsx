import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { getContestList, ContestItem } from "../api/codeBattleApi";
import "./AppLayout.css";
import "./BattleHomePage.css";

type BattleTab = "home" | "problems" | "contest" | "help";

const PAGE_SIZE = 10;
const VALID_BATTLE_TABS: BattleTab[] = ["home", "problems", "contest", "help"];

function getTabFromHash(): BattleTab {
  const parts = window.location.hash.replace("#", "").split("/");
  const tab = parts[1] as BattleTab;
  return VALID_BATTLE_TABS.includes(tab) ? tab : "home";
}

const BattlePage: React.FC = () => {
  const { user, logout, navigate } = useApp();
  const [activeTab, setActiveTab] = useState<BattleTab>(getTabFromHash);

  // 대회 목록 상태
  const [contests, setContests] = useState<ContestItem[]>([]);
  const [contestPage, setContestPage] = useState(0);
  const [contestTotalPages, setContestTotalPages] = useState(0);
  const [contestLoading, setContestLoading] = useState(false);
  const [contestError, setContestError] = useState<string | null>(null);

  useEffect(() => {
    const handleHashChange = () => {
      const parts = window.location.hash.replace("#", "").split("/");
      if (parts[0] === "battle") {
        const tab = parts[1] as BattleTab;
        setActiveTab(VALID_BATTLE_TABS.includes(tab) ? tab : "home");
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleTabChange = (tab: BattleTab) => {
    window.location.hash = `battle/${tab}`;
    setActiveTab(tab);
  };

  const fetchContests = useCallback(async (page: number) => {
    setContestLoading(true);
    setContestError(null);
    try {
      const data = await getContestList(page, PAGE_SIZE, ["id,desc"]);
      setContests(data.content);
      setContestTotalPages(data.totalPages);
    } catch (e: any) {
      setContestError("대회 목록을 불러오지 못했습니다.");
    } finally {
      setContestLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "contest") {
      fetchContests(contestPage);
    }
  }, [activeTab, contestPage, fetchContests]);

  return (
    <div className="home-page battle-home-page">
      <header className="home-header">
        <span className="home-logo" onClick={() => navigate("landing")}>ASAP 캡스톤</span>
        <nav className="home-tab-nav">
          <button
            className={`home-tab-btn${activeTab === "home" ? " home-tab-btn--active" : ""}`}
            onClick={() => handleTabChange("home")}
          >
            홈
          </button>
          <button
            className={`home-tab-btn${activeTab === "problems" ? " home-tab-btn--active" : ""}`}
            onClick={() => handleTabChange("problems")}
          >
            문제
          </button>
          <button
            className={`home-tab-btn${activeTab === "contest" ? " home-tab-btn--active" : ""}`}
            onClick={() => handleTabChange("contest")}
          >
            대회
          </button>
          <button
            className={`home-tab-btn${activeTab === "help" ? " home-tab-btn--active" : ""}`}
            onClick={() => handleTabChange("help")}
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
              <div
                className="bp-problem-card"
                onClick={() => { window.location.hash = "submit/1"; }}
              >
                <div className="bp-problem-card-left">
                  <span className="bp-problem-num">#1</span>
                  <div>
                    <p className="bp-problem-title">치토 배틀</p>
                    <p className="bp-problem-desc">AI 코드를 제출하여 상대방의 치토와 배틀을 펼치세요.</p>
                  </div>
                </div>
                <div className="bp-problem-card-right">
                  <span className="bp-problem-difficulty">일반</span>
                  <span className="bp-problem-arrow">→</span>
                </div>
              </div>
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

            {contestLoading && (
              <div className="bp-contest-empty">
                <span className="bp-contest-empty-text">불러오는 중...</span>
              </div>
            )}

            {contestError && (
              <div className="bp-contest-empty">
                <span className="bp-contest-empty-text" style={{ color: "#dc2626" }}>{contestError}</span>
              </div>
            )}

            {!contestLoading && !contestError && contests.length === 0 && (
              <div className="bp-contest-empty">
                <span className="bp-contest-empty-text">아직 등록된 대회가 없습니다.</span>
              </div>
            )}

            {!contestLoading && !contestError && contests.length > 0 && (
              <>
                <div className="bp-problem-list">
                  {contests.map((c) => (
                    <div
                      key={c.id}
                      className="bp-problem-card"
                      onClick={() => { window.location.hash = `submit/${c.id}`; }}
                    >
                      <div className="bp-problem-card-left">
                        <span className="bp-problem-num">#{c.id}</span>
                        <div>
                          <p className="bp-problem-title">{c.title}</p>
                          {c.description && (
                            <p className="bp-problem-desc">{c.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="bp-problem-card-right">
                        {c.status && (
                          <span className="bp-problem-difficulty">{c.status}</span>
                        )}
                        <span className="bp-problem-arrow">→</span>
                      </div>
                    </div>
                  ))}
                </div>

                {contestTotalPages > 1 && (
                  <div className="bp-pagination">
                    <button
                      className="bp-page-btn"
                      disabled={contestPage === 0}
                      onClick={() => setContestPage((p) => p - 1)}
                    >
                      ← 이전
                    </button>
                    <span className="bp-page-info">
                      {contestPage + 1} / {contestTotalPages}
                    </span>
                    <button
                      className="bp-page-btn"
                      disabled={contestPage >= contestTotalPages - 1}
                      onClick={() => setContestPage((p) => p + 1)}
                    >
                      다음 →
                    </button>
                  </div>
                )}
              </>
            )}
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
