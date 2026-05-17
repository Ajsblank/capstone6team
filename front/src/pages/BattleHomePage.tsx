import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { getContestList, ContestItem } from "../api/codeBattleApi";
import "./AppLayout.css";
import "./BattleHomePage.css";

type BattleTab = "contest" | "ranking" | "help";

const PAGE_SIZE = 10;
const VALID_BATTLE_TABS: BattleTab[] = ["contest", "ranking", "help"];

function getTabFromHash(): BattleTab {
  const parts = window.location.hash.replace("#", "").split("/");
  const tab = parts[1] as BattleTab;
  return VALID_BATTLE_TABS.includes(tab) ? tab : "contest";
}

const BattlePage: React.FC = () => {
  const { user, logout, navigate, joinedContestIds, hostedContestIds } = useApp();
  const [activeTab, setActiveTab] = useState<BattleTab>(getTabFromHash);

  // 대회 목록 상태
  const [contests, setContests] = useState<ContestItem[]>([]);
  const [contestPage, setContestPage] = useState(0);
  const [contestTotalPages, setContestTotalPages] = useState(0);
  const [contestLoading, setContestLoading] = useState(false);
  const [contestError, setContestError] = useState<string | null>(null);
  const [blockedPopup, setBlockedPopup] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      const parts = window.location.hash.replace("#", "").split("/");
      if (parts[0] === "battle" && parts[1]) {
        const tab = parts[1] as BattleTab;
        if (VALID_BATTLE_TABS.includes(tab)) setActiveTab(tab);
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
    if (activeTab === "contest") fetchContests(contestPage);
  }, [activeTab, contestPage, fetchContests]);

  return (
    <div className="home-page battle-home-page">
      {blockedPopup && (
        <div className="bp-popup-overlay" onClick={() => setBlockedPopup(false)}>
          <div className="bp-popup" onClick={e => e.stopPropagation()}>
            <p className="bp-popup-msg">아직 대회 참가할 수 없습니다.</p>
            <button className="bp-popup-btn" onClick={() => setBlockedPopup(false)}>확인</button>
          </div>
        </div>
      )}
      <header className="home-header">
        <span className="home-logo" onClick={() => navigate("landing")}>
          <img src="/resources/logo/TacticalCodeBattle_logo.png" alt="TCB" className="home-logo-img" />
        </span>
        <nav className="home-tab-nav">
          <button
            className={`home-tab-btn${activeTab === "contest" ? " home-tab-btn--active" : ""}`}
            onClick={() => handleTabChange("contest")}
          >
            대회
          </button>
          <button
            className="home-tab-btn home-tab-btn--disabled"
            title="준비 중인 기능입니다"
          >
            랭킹
          </button>
          <button
            className="home-tab-btn home-tab-btn--disabled"
            title="준비 중인 기능입니다"
          >
            도움말
          </button>
        </nav>
        <div className="home-auth-area">
          {user ? (
            <>
              <span className="home-username" onClick={() => navigate("profile")}>{user.username}</span>
              <button className="home-auth-btn home-auth-btn--secondary" onClick={() => navigate("account-settings")}>설정</button>
              <button className="home-auth-btn home-auth-btn--ghost" onClick={() => logout()}>로그아웃</button>
            </>
          ) : (
            <>
              <button className="home-auth-btn home-auth-btn--ghost" onClick={() => navigate("signup")}>회원가입</button>
              <button className="home-auth-btn home-auth-btn--primary" onClick={() => {
                localStorage.setItem("loginRedirect", window.location.hash.replace("#", "") || "battle");
                navigate("login");
              }}>로그인</button>
            </>
          )}
        </div>
      </header>

      <main className="home-body">
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
                  {[...contests]
                    .sort((a, b) => {
                      const aPriority = joinedContestIds.includes(a.id) || hostedContestIds.includes(a.id) ? 0 : 1;
                      const bPriority = joinedContestIds.includes(b.id) || hostedContestIds.includes(b.id) ? 0 : 1;
                      return aPriority - bPriority;
                    })
                    .map((c) => (
                    <div
                      key={c.id}
                      className="bp-problem-card"
                      onClick={() => {
                        if (c.status === "PLANNED") { setBlockedPopup(true); return; }
                        window.location.hash = `submit/${c.id}`;
                      }}
                    >
                      <div className="bp-problem-card-left">
                        <span className="bp-problem-num">#{c.id}</span>
                        <div>
                          <p className="bp-problem-title">
                            {c.title}
                            {joinedContestIds.includes(c.id) && (
                              <span className="bp-contest-badge bp-contest-badge--joined">참가중</span>
                            )}
                            {hostedContestIds.includes(c.id) && (
                              <span className="bp-contest-badge bp-contest-badge--hosted">검수중</span>
                            )}
                          </p>
                          {c.description && (
                            <p className="bp-problem-desc">{c.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="bp-problem-card-right">
                        {c.status && (
                          <span className={`bp-problem-difficulty${
                            c.status === "TEST"    ? " bp-problem-difficulty--test"    :
                            c.status === "PLANNED" ? " bp-problem-difficulty--planned" :
                            c.status === "RUNNING" ? " bp-problem-difficulty--running" : ""
                          }`}>
                            {c.status === "PLANNED" ? "개최 예정" :
                             c.status === "RUNNING" ? "개최 중" :
                             c.status}
                          </span>
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

        {/* 랭킹 탭 */}
        {activeTab === "ranking" && (
          <div className="home-placeholder">
            <span className="home-placeholder-text">랭킹 — 준비 중입니다.</span>
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
