import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { getContestList, ContestItem } from "../api/codeBattleApi";
import "./AppLayout.css";
import "./BattleHomePage.css";

type BattleTab = "contest" | "ranking" | "help";
type StatusFilter = "" | "RUNNING" | "PLANNED" | "END";

const FETCH_SIZE = 100;
const VALID_BATTLE_TABS: BattleTab[] = ["contest", "ranking", "help"];

const STATUS_LABEL: Record<string, string> = {
  RUNNING: "개최 중",
  PLANNED: "개최 예정",
  END:     "종료",
  TEST:    "TEST",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function statusCardClass(status?: string): string {
  if (status === "RUNNING") return " bp-problem-card--running";
  if (status === "PLANNED") return " bp-problem-card--planned";
  if (status === "END")     return " bp-problem-card--ended";
  if (status === "TEST")    return " bp-problem-card--test";
  return "";
}

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
  const [contestLoading, setContestLoading] = useState(false);
  const [contestError, setContestError] = useState<string | null>(null);
  const [blockedPopup, setBlockedPopup] = useState(false);

  // 필터 상태
  const [filterStatus, setFilterStatus]       = useState<StatusFilter>("");
  const [filterName,   setFilterName]         = useState("");
  const [filterStartFrom, setFilterStartFrom] = useState("");
  const [filterEndTo,     setFilterEndTo]     = useState("");

  const hasFilters = !!(filterStatus || filterName || filterStartFrom || filterEndTo);

  const resetFilters = () => {
    setFilterStatus("");
    setFilterName("");
    setFilterStartFrom("");
    setFilterEndTo("");
  };

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

  const fetchContests = useCallback(async () => {
    setContestLoading(true);
    setContestError(null);
    try {
      const data = await getContestList(0, FETCH_SIZE, ["id,desc"]);
      setContests(data.content);
    } catch {
      setContestError("대회 목록을 불러오지 못했습니다.");
    } finally {
      setContestLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "contest") fetchContests();
  }, [activeTab, fetchContests]);

  const STATUS_PRIORITY: Record<string, number> = { RUNNING: 2, PLANNED: 3, END: 4, TEST: 5 };

  function sortPriority(c: ContestItem): number {
    if (hostedContestIds.includes(c.id))  return 0;
    if (joinedContestIds.includes(c.id))  return 1;
    return STATUS_PRIORITY[c.status ?? ""] ?? 4;
  }

  // 필터 + 우선순위 정렬
  const filteredContests = [...contests]
    .sort((a, b) => sortPriority(a) - sortPriority(b))
    .filter(c => {
      if (filterStatus && c.status !== filterStatus) return false;
      if (filterName && !c.title.toLowerCase().includes(filterName.toLowerCase())) return false;
      if (filterStartFrom && c.startTime) {
        if (new Date(c.startTime) < new Date(filterStartFrom)) return false;
      }
      if (filterEndTo && c.endTime) {
        const to = new Date(filterEndTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(c.endTime) > to) return false;
      }
      return true;
    });

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
          <button
            className="home-tab-btn home-tab-btn--disabled"
            title="준비 중인 기능입니다"
          >
            문의
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
              <button className="bp-create-contest-btn" onClick={() => navigate("create-contest")}>
                + 대회 개최
              </button>
            </div>

            {/* ── 필터 바 ── */}
            <div className="bp-filter-bar">
              <select
                className="bp-filter-select"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as StatusFilter)}
              >
                <option value="">전체</option>
                <option value="RUNNING">개최 중</option>
                <option value="PLANNED">개최 예정</option>
                <option value="END">종료</option>
              </select>

              <input
                className="bp-filter-input"
                type="text"
                placeholder="대회명 검색"
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
              />

              <div className="bp-filter-date-group">
                <label className="bp-filter-date-label">시작일</label>
                <input
                  className="bp-filter-date"
                  type="date"
                  value={filterStartFrom}
                  onChange={e => setFilterStartFrom(e.target.value)}
                />
                <span className="bp-filter-date-sep">~</span>
                <label className="bp-filter-date-label">종료일</label>
                <input
                  className="bp-filter-date"
                  type="date"
                  value={filterEndTo}
                  onChange={e => setFilterEndTo(e.target.value)}
                />
              </div>

              {hasFilters && (
                <button className="bp-filter-reset" onClick={resetFilters}>초기화</button>
              )}
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

            {!contestLoading && !contestError && (
              <>
                {filteredContests.length === 0 ? (
                  <div className="bp-contest-empty">
                    <span className="bp-contest-empty-text">
                      {hasFilters ? "조건에 맞는 대회가 없습니다." : "아직 등록된 대회가 없습니다."}
                    </span>
                  </div>
                ) : (
                  <>
                    <p className="bp-filter-count">총 {filteredContests.length}개 대회</p>
                    <div className="bp-problem-list">
                      {filteredContests.map(c => (
                        <div
                          key={c.id}
                          className={`bp-problem-card${statusCardClass(c.status)}`}
                          onClick={() => {
                            if (c.status === "PLANNED" && !hostedContestIds.includes(c.id)) { setBlockedPopup(true); return; }
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
                              {(c.startTime || c.endTime) && (
                                <p className="bp-problem-dates">
                                  <span className="bp-problem-dates-icon">📅</span>
                                  {c.startTime && <span>{formatDate(c.startTime)}</span>}
                                  {c.startTime && c.endTime && <span className="bp-problem-dates-sep">~</span>}
                                  {c.endTime && <span>{formatDate(c.endTime)}</span>}
                                </p>
                              )}
                              {c.description && <p className="bp-problem-desc">{c.description}</p>}
                            </div>
                          </div>
                          <div className="bp-problem-card-right">
                            {c.status && (
                              <span className={`bp-problem-difficulty${
                                c.status === "TEST"    ? " bp-problem-difficulty--test"    :
                                c.status === "PLANNED" ? " bp-problem-difficulty--planned" :
                                c.status === "RUNNING" ? " bp-problem-difficulty--running" :
                                c.status === "END"     ? " bp-problem-difficulty--ended"   : ""
                              }`}>
                                {c.status === "RUNNING" && <span className="bp-status-dot" />}
                                {STATUS_LABEL[c.status] ?? c.status}
                              </span>
                            )}
                            <span className="bp-problem-arrow">→</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
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
