import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { getContestList, ContestItem } from "../api/codeBattleApi";
import "./AppLayout.css";
import "./BattleHomePage.css";

type BattleTab = "contest" | "ranking" | "help" | "contact";
type StatusFilter = "" | "RUNNING" | "PLANNED" | "END";

const FETCH_SIZE = 100;
const VALID_BATTLE_TABS: BattleTab[] = ["contest", "ranking", "help", "contact"];

const HELP_ITEMS: { title: string; summary: string; body: React.ReactNode }[] = [
  {
    title: "Tactical Code Battle란?",
    summary: "플랫폼 개요 및 핵심 개념",
    body: (
      <>
        <p className="bp-info-text">
          Tactical Code Battle(TCB)는 참가자가 작성한 <strong>AI 코드끼리 자동으로 대결</strong>하는 알고리즘 경쟁 플랫폼입니다.
          전략을 코드로 구현해 제출하면 서버가 예시 AI와 매치를 진행하고, 스위스 토너먼트 세션을 통해 참가자들의 순위를 결정합니다.
        </p>
        <p className="bp-info-text">
          로그 분석 뷰어로 매치 과정을 시각적으로 재현하거나, 혼자서 하기 기능으로 자신의 전략을 직접 시험해볼 수 있습니다.
        </p>
        <div className="bp-info-badges" style={{ marginTop: 4 }}>
          {["C++20", "Java 21", "Python3 / PyPy3"].map(lang => (
            <span key={lang} className="bp-info-badge">{lang}</span>
          ))}
        </div>
      </>
    ),
  },
  {
    title: "대회 진행 방식",
    summary: "참가 신청부터 최종 결과까지",
    body: (
      <ol className="bp-info-list">
        <li>대회 목록에서 원하는 대회를 선택하고 <strong>대회 참가</strong> 버튼을 클릭합니다.</li>
        <li><strong>문제</strong> 탭에서 게임 규칙과 입출력 형식을 확인합니다.</li>
        <li><strong>제출</strong> 탭에서 전략 코드를 작성하고 제출합니다. 횟수 제한은 없으며, 세션 시작 시점의 최신 코드가 사용됩니다.</li>
        <li>세션이 시작되면 <strong>스위스 토너먼트</strong> 방식으로 라운드가 진행됩니다. 비슷한 점수대 참가자끼리 매칭되며,
          승리 <strong>+1점</strong> / 무승부 <strong>0점</strong> / 패배 <strong>-1점</strong>이 부여됩니다.</li>
        <li><strong>중간 결과</strong> 탭에서 세션 진행 상황과 실시간 순위를 확인할 수 있습니다.</li>
        <li>대회 종료 시간이 되면, <strong>풀리그 방식</strong> 으로 최종 결과를 산출합니다. <strong>최종 결과</strong> 탭에서 대회 최종 순위를 확인합니다.</li>
      </ol>
    ),
  },
  {
    title: "인증 · 비인증 대회의 차이",
    summary: "공식 인증 대회와 일반 대회 비교",
    body: (
      <div className="bp-help-compare">
        <div className="bp-help-compare-col bp-help-compare-col--uncert">
          <div className="bp-help-compare-head">비인증 대회</div>
          <ul className="bp-info-list">
            <li>로그인한 누구나 즉시 개설 가능</li>
            <li>시각화 · 혼자서 하기 파일 선택 사항</li>
            <li>테스트 · 연습 목적에 적합</li>
          </ul>
        </div>
        <div className="bp-help-compare-col bp-help-compare-col--cert">
          <div className="bp-help-compare-head">인증 대회</div>
          <ul className="bp-info-list">
            <li>플랫폼 운영팀의 공식 검수 필요</li>
            <li>시각화 · 혼자서 하기 파일 <strong>필수</strong></li>
            <li>공식 경쟁 · 수료 목적에 적합</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: "대회 개최 방법",
    summary: "필수 항목 및 개설 절차 안내",
    body: (
      <>
        <p className="bp-info-text">로그인 후 대회 목록 페이지 우측 상단의 <strong>대회 개최</strong> 버튼을 클릭합니다.</p>
        <ol className="bp-info-list" style={{ marginTop: 10 }}>
          <li><strong>대회 이름</strong>과 <strong>인증 여부</strong>를 설정합니다.</li>
          <li><strong>문제 설명</strong>을 작성합니다. HTML · Markdown · Word 파일 불러오기를 지원합니다.</li>
          <li>필수 파일을 첨부합니다.
            <ul className="bp-info-list" style={{ marginTop: 6 }}>
              <li><strong>샘플 코드</strong> — 참가자에게 제공할 시작 코드 (여러 파일 가능)</li>
              <li><strong>채점 코드</strong> — 두 코드의 대결을 실행하고 승패를 판정하는 코드</li>
              <li><strong>예시 AI 코드</strong> — 제출 코드와 대결할 기준 AI (여러 파일 가능)</li>
              <li><strong>시각화 HTML</strong> — 로그 분석 뷰어 (인증 대회 필수)</li>
              <li><strong>혼자서 하기 HTML</strong> — 단독 플레이 뷰어 (인증 대회 필수)</li>
            </ul>
          </li>
          <li>시작 · 종료 일시와 최대 참가자 수를 설정합니다.</li>
          <li>비인증이면 <strong>대회 생성</strong>으로 즉시 개설, 인증이면 <strong>다음 단계로</strong>를 클릭해 검수 신청을 진행합니다.</li>
        </ol>
      </>
    ),
  },
];

const STATUS_LABEL: Record<string, string> = {
  RUNNING:  "개최 중",
  PLANNED:  "개최 예정",
  END:      "종료",
  CANCELED: "종료",
  TEST:     "TEST",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function statusCardClass(status?: string): string {
  if (status === "RUNNING")  return " bp-problem-card--running";
  if (status === "PLANNED")  return " bp-problem-card--planned";
  if (status === "END")      return " bp-problem-card--ended";
  if (status === "CANCELED") return " bp-problem-card--ended";
  if (status === "TEST")     return " bp-problem-card--test";
  return "";
}

const RANKING_DATA = [
  { rank: 1,  username: "CodeMaster_Kim",    points: 9840, cert: 15, uncert: 8  },
  { rank: 2,  username: "AlgoQueen_Park",    points: 8920, cert: 12, uncert: 11 },
  { rank: 3,  username: "ByteWizard_Lee",    points: 8100, cert: 10, uncert: 14 },
  { rank: 4,  username: "NeuroHacker_Choi",  points: 7560, cert: 9,  uncert: 7  },
  { rank: 5,  username: "QuantumCoder_Jung", points: 7200, cert: 8,  uncert: 10 },
  { rank: 6,  username: "DataStorm_Han",     points: 6880, cert: 7,  uncert: 9  },
  { rank: 7,  username: "NullPointer_Oh",    points: 6430, cert: 6,  uncert: 12 },
  { rank: 8,  username: "RecursiveKim",      points: 5970, cert: 8,  uncert: 5  },
  { rank: 9,  username: "SortedShin",        points: 5510, cert: 5,  uncert: 8  },
  { rank: 10, username: "BitFlipper_Yoon",   points: 5200, cert: 6,  uncert: 6  },
  { rank: 11, username: "HashQueen_Kang",    points: 4890, cert: 4,  uncert: 9  },
  { rank: 12, username: "GreedyLim",         points: 4440, cert: 5,  uncert: 7  },
  { rank: 13, username: "DPMaster_Jang",     points: 4100, cert: 4,  uncert: 6  },
  { rank: 14, username: "GraphHero_Bae",     points: 3760, cert: 3,  uncert: 8  },
  { rank: 15, username: "SegTree_Son",       points: 3420, cert: 3,  uncert: 5  },
  { rank: 16, username: "KnightCoder_Kwon",  points: 3080, cert: 2,  uncert: 7  },
  { rank: 17, username: "XorMaster_Ahn",     points: 2740, cert: 2,  uncert: 6  },
  { rank: 18, username: "LoopBreaker_Baek",  points: 2310, cert: 1,  uncert: 5  },
  { rank: 19, username: "HeapSort_Jeon",     points: 1980, cert: 1,  uncert: 4  },
  { rank: 20, username: "Rookie_Noh",        points: 1540, cert: 0,  uncert: 3  },
];

function getTabFromHash(): BattleTab {
  const parts = window.location.hash.replace("#", "").split("/");
  const tab = parts[1] as BattleTab;
  return VALID_BATTLE_TABS.includes(tab) ? tab : "contest";
}

const BattlePage: React.FC = () => {
  const { user, logout, navigate, joinedContestIds, hostedContestIds, createdContestIds } = useApp();
  const [activeTab, setActiveTab] = useState<BattleTab>(getTabFromHash);
  const [expandedHelp, setExpandedHelp] = useState<number | null>(null);

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
    if (tab !== "help") setExpandedHelp(null);
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

  function sortPriority(c: ContestItem): number {
    const isHosted = hostedContestIds.includes(c.id);
    const isJoined = joinedContestIds.includes(c.id);
    switch (c.status) {
      case "RUNNING":  return isHosted ? 0 : isJoined ? 1 : 2;
      case "PLANNED":  return isHosted ? 3 : isJoined ? 4 : 5;
      case "END":      return isHosted ? 6 : isJoined ? 7 : 8;
      case "TEST":     return 9;
      case "CANCELED": return isHosted ? 10 : isJoined ? 11 : 12;
      default:         return 8;
    }
  }

  // 최근 1일 이내 종료된 참가 대회
  const recentEndedContests = contests.filter(c =>
    (c.status === "END" || c.status === "CANCELED") &&
    joinedContestIds.includes(c.id) &&
    c.endDate &&
    (() => {
      const diff = Date.now() - new Date(c.endDate!).getTime();
      return diff >= 0 && diff <= 24 * 60 * 60 * 1000;
    })()
  );

  // 필터 + 우선순위 정렬
  const filteredContests = [...contests]
    .sort((a, b) => sortPriority(a) - sortPriority(b))
    .filter(c => {
      if (filterStatus && c.status !== filterStatus) return false;
      if (filterName && !c.title.toLowerCase().includes(filterName.toLowerCase())) return false;
      if (filterStartFrom && c.startDate) {
        if (new Date(c.startDate) < new Date(filterStartFrom)) return false;
      }
      if (filterEndTo && c.endDate) {
        const to = new Date(filterEndTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(c.endDate) > to) return false;
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
            className={`home-tab-btn${activeTab === "ranking" ? " home-tab-btn--active" : ""}`}
            onClick={() => handleTabChange("ranking")}
          >
            랭킹
          </button>
          <button
            className={`home-tab-btn${activeTab === "help" ? " home-tab-btn--active" : ""}`}
            onClick={() => handleTabChange("help")}
          >
            도움말
          </button>
          <button
            className={`home-tab-btn${activeTab === "contact" ? " home-tab-btn--active" : ""}`}
            onClick={() => handleTabChange("contact")}
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
            {recentEndedContests.length > 0 && (
              <div className="bp-result-notify">
                {/* 좌측: 안내 텍스트 */}
                <div className="bp-result-notify-left">
                  <span className="bp-result-notify-dot" />
                  <div className="bp-result-notify-content">
                    <span className="bp-result-notify-headline">
                      최근 참가하신 대회가 종료되었습니다.
                      <span className="bp-result-notify-arrow">→</span>
                    </span>
                    <span className="bp-result-notify-sub">클릭하여 최종 결과를 확인하세요.</span>
                  </div>
                </div>

                {/* 우측: 대회 미니 카드 (클릭 영역) */}
                <div className="bp-result-notify-cards">
                  {recentEndedContests.map(c => (
                    <button
                      key={c.id}
                      className="bp-result-mini-card"
                      onClick={() => { window.location.hash = `submit/${c.id}/final-result`; }}
                    >
                      <div className="bp-result-mini-left">
                        <p className="bp-result-mini-title">
                          {c.title}
                          {joinedContestIds.includes(c.id) && (
                            <span className="bp-contest-badge bp-contest-badge--joined">참가</span>
                          )}
                          {hostedContestIds.includes(c.id) && (
                            <span className="bp-contest-badge bp-contest-badge--hosted">검수</span>
                          )}
                          {createdContestIds.includes(c.id) && (
                            <span className="bp-contest-badge bp-contest-badge--created">개최</span>
                          )}
                        </p>
                        {(c.startDate || c.endDate) && (
                          <p className="bp-result-mini-dates">
                            <span>📅</span>
                            {c.startDate && <span>{formatDate(c.startDate)}</span>}
                            {c.startDate && c.endDate && <span>~</span>}
                            {c.endDate && <span>{formatDate(c.endDate)}</span>}
                          </p>
                        )}
                      </div>
                      <div className="bp-result-mini-right">
                        {c.status === "CANCELED" && (
                          <span className="bp-canceled-warn" title="참가자 수 부족으로 최종 결과가 집계되지 않았습니다">!</span>
                        )}
                        <span className="bp-problem-difficulty bp-problem-difficulty--ended">종료</span>
                        <span className="bp-problem-arrow">›</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                            if (c.status === "PLANNED" && !hostedContestIds.includes(c.id) && !createdContestIds.includes(c.id)) { setBlockedPopup(true); return; }
                            window.location.hash = `submit/${c.id}`;
                          }}
                        >
                          <div className="bp-problem-card-left">
                            <span className="bp-problem-num">#{c.id}</span>
                            <div>
                              <p className="bp-problem-title">
                                {c.title}
                                {joinedContestIds.includes(c.id) && (
                                  <span className="bp-contest-badge bp-contest-badge--joined">
                                    {(c.status === "END" || c.status === "CANCELED") ? "참가" : "참가중"}
                                  </span>
                                )}
                                {hostedContestIds.includes(c.id) && (
                                  <span className="bp-contest-badge bp-contest-badge--hosted">
                                    {(c.status === "END" || c.status === "CANCELED") ? "검수" : "검수중"}
                                  </span>
                                )}
                                {createdContestIds.includes(c.id) && (
                                  <span className="bp-contest-badge bp-contest-badge--created">개최</span>
                                )}
                              </p>
                              {(c.startDate || c.endDate) && (
                                <p className="bp-problem-dates">
                                  <span className="bp-problem-dates-icon">📅</span>
                                  {c.startDate && <span>{formatDate(c.startDate)}</span>}
                                  {c.startDate && c.endDate && <span className="bp-problem-dates-sep">~</span>}
                                  {c.endDate && <span>{formatDate(c.endDate)}</span>}
                                </p>
                              )}

                            </div>
                          </div>
                          <div className="bp-problem-card-right">
                            {c.status && (
                              <div className="bp-status-area">
                                {c.status === "CANCELED" && (
                                  <span
                                    className="bp-canceled-warn"
                                    title="참가자 수 부족으로 최종 결과가 집계되지 않았습니다"
                                  >!</span>
                                )}
                                <span className={`bp-problem-difficulty${
                                  c.status === "TEST"                ? " bp-problem-difficulty--test"    :
                                  c.status === "PLANNED"             ? " bp-problem-difficulty--planned" :
                                  c.status === "RUNNING"             ? " bp-problem-difficulty--running" :
                                  c.status === "END" ||
                                  c.status === "CANCELED"            ? " bp-problem-difficulty--ended"   : ""
                                }`}>
                                  {c.status === "RUNNING" && <span className="bp-status-dot" />}
                                  {STATUS_LABEL[c.status] ?? c.status}
                                </span>
                              </div>
                            )}
                            {createdContestIds.includes(c.id) && (c.status === "PLANNED" || c.status === "RUNNING") && (
                              <button
                                className="bp-settings-btn"
                                title="대회 설정"
                                onClick={e => {
                                  e.stopPropagation();
                                  window.location.hash = `contest-settings/${c.id}`;
                                }}
                              >
                                ⚙
                              </button>
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
          <div className="bp-ranking-page">
            <div className="bp-ranking-header">
              <h2 className="bp-ranking-title">글로벌 랭킹</h2>
              <p className="bp-ranking-subtitle">포인트 기준 전체 순위 (목업 데이터)</p>
            </div>

            {/* 포디움 Top 3 */}
            <div className="bp-ranking-podium">
              <div className="bp-podium-card bp-podium-card--2nd">
                <div className="bp-podium-emblem">🥈</div>
                <div className="bp-podium-avatar bp-podium-avatar--2nd">{RANKING_DATA[1].username.charAt(0)}</div>
                <div className="bp-podium-name">{RANKING_DATA[1].username}</div>
                <div className="bp-podium-pts">{RANKING_DATA[1].points.toLocaleString()}<span>pts</span></div>
                <div className="bp-podium-stats">
                  <span className="bp-podium-cert-badge">인증 {RANKING_DATA[1].cert}</span>
                  <span className="bp-podium-uncert-badge">비인증 {RANKING_DATA[1].uncert}</span>
                </div>
                <div className="bp-podium-plinth bp-podium-plinth--2nd"><span>2</span></div>
              </div>
              <div className="bp-podium-card bp-podium-card--1st">
                <div className="bp-podium-crown-wrap"><span className="bp-podium-crown-icon">👑</span></div>
                <div className="bp-podium-avatar bp-podium-avatar--1st">{RANKING_DATA[0].username.charAt(0)}</div>
                <div className="bp-podium-name">{RANKING_DATA[0].username}</div>
                <div className="bp-podium-pts">{RANKING_DATA[0].points.toLocaleString()}<span>pts</span></div>
                <div className="bp-podium-stats">
                  <span className="bp-podium-cert-badge">인증 {RANKING_DATA[0].cert}</span>
                  <span className="bp-podium-uncert-badge">비인증 {RANKING_DATA[0].uncert}</span>
                </div>
                <div className="bp-podium-plinth bp-podium-plinth--1st"><span>1</span></div>
              </div>
              <div className="bp-podium-card bp-podium-card--3rd">
                <div className="bp-podium-emblem">🥉</div>
                <div className="bp-podium-avatar bp-podium-avatar--3rd">{RANKING_DATA[2].username.charAt(0)}</div>
                <div className="bp-podium-name">{RANKING_DATA[2].username}</div>
                <div className="bp-podium-pts">{RANKING_DATA[2].points.toLocaleString()}<span>pts</span></div>
                <div className="bp-podium-stats">
                  <span className="bp-podium-cert-badge">인증 {RANKING_DATA[2].cert}</span>
                  <span className="bp-podium-uncert-badge">비인증 {RANKING_DATA[2].uncert}</span>
                </div>
                <div className="bp-podium-plinth bp-podium-plinth--3rd"><span>3</span></div>
              </div>
            </div>

            {/* 4·5위 */}
            <div className="bp-ranking-top5-wrap">
              {RANKING_DATA.slice(3, 5).map(u => (
                <div key={u.rank} className={`bp-top5-row bp-top5-row--${u.rank}`}>
                  <span className="bp-top5-rank">{u.rank}</span>
                  <div className="bp-top5-avatar">{u.username.charAt(0)}</div>
                  <span className="bp-top5-name">{u.username}</span>
                  <div className="bp-top5-stats">
                    <span className="bp-top5-cert">인증 {u.cert}</span>
                    <span className="bp-top5-uncert">비인증 {u.uncert}</span>
                  </div>
                  <span className="bp-top5-pts">{u.points.toLocaleString()} pts</span>
                </div>
              ))}
            </div>

            {/* 6–20위 */}
            <div className="bp-ranking-table-wrap">
              <table className="bp-ranking-table">
                <thead>
                  <tr>
                    <th className="bp-th-num">순위</th>
                    <th className="bp-th-user">사용자</th>
                    <th className="bp-th-pts">포인트</th>
                    <th className="bp-th-cert">인증 대회</th>
                    <th className="bp-th-uncert">비인증 대회</th>
                    <th className="bp-th-total">총 참가</th>
                  </tr>
                </thead>
                <tbody>
                  {RANKING_DATA.slice(5).map(u => (
                    <tr key={u.rank} className="bp-rank-row">
                      <td className="bp-rank-num">{u.rank}</td>
                      <td className="bp-rank-user">
                        <span className="bp-rank-avatar">{u.username.charAt(0)}</span>
                        {u.username}
                      </td>
                      <td className="bp-rank-pts">{u.points.toLocaleString()}</td>
                      <td className="bp-rank-cert">{u.cert}</td>
                      <td className="bp-rank-uncert">{u.uncert}</td>
                      <td className="bp-rank-total">{u.cert + u.uncert}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 도움말 탭 */}
        {activeTab === "help" && (
          <div className="bp-help-page">
            <div className="bp-help-layout">
              {/* 좌측 목록 */}
              <nav className="bp-help-nav">
                <div className="bp-help-nav-heading">도움말</div>
                {HELP_ITEMS.map((item, i) => (
                  <button
                    key={i}
                    className={`bp-help-nav-item${expandedHelp === i ? " bp-help-nav-item--active" : ""}`}
                    onClick={() => setExpandedHelp(expandedHelp === i ? null : i)}
                  >
                    <span className="bp-help-nav-num">{String(i + 1).padStart(2, "0")}</span>
                    <div className="bp-help-nav-text">
                      <span className="bp-help-nav-label">{item.title}</span>
                      <span className="bp-help-nav-desc">{item.summary}</span>
                    </div>
                    <span className="bp-help-nav-arrow">›</span>
                  </button>
                ))}
              </nav>
              {/* 우측 상세 */}
              <div className="bp-help-detail-wrap">
                {expandedHelp !== null ? (
                  <div key={expandedHelp} className="bp-help-detail">
                    <div className="bp-help-detail-header">
                      <span className="bp-help-detail-num">{String(expandedHelp + 1).padStart(2, "0")}</span>
                      <h3 className="bp-help-detail-title">{HELP_ITEMS[expandedHelp].title}</h3>
                    </div>
                    <div className="bp-help-detail-body">{HELP_ITEMS[expandedHelp].body}</div>
                  </div>
                ) : (
                  <div className="bp-help-detail-empty">
                    좌측 목록에서 항목을 선택하면 자세한 내용이 표시됩니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 문의 탭 */}
        {activeTab === "contact" && (
          <div className="bp-info-page">
            <h2 className="bp-info-title">문의</h2>

            <section className="bp-info-section">
              <h3 className="bp-info-section-title">개발팀 연락처</h3>
              <p className="bp-info-text">
                버그 제보, 기능 제안, 대회 개설 문의는 아래 채널로 연락해 주세요.
              </p>
              <div className="bp-contact-cards">
                <div className="bp-contact-card">
                  <span className="bp-contact-icon">✉</span>
                  <div>
                    <div className="bp-contact-label">이메일</div>
                    <div className="bp-contact-value">team06asap@ajou.ac.kr</div>
                  </div>
                </div>
                <div className="bp-contact-card">
                  <span className="bp-contact-icon">🏫</span>
                  <div>
                    <div className="bp-contact-label">소속</div>
                    <div className="bp-contact-value">아주대학교 소프트웨어학과 캡스톤 프로젝트</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="bp-info-section">
              <h3 className="bp-info-section-title">버그 리포트 시 포함 사항</h3>
              <ol className="bp-info-list">
                <li>발생한 페이지 및 탭 이름</li>
                <li>재현 방법 (어떤 동작을 했는지)</li>
                <li>브라우저 개발자 도구 콘솔 오류 메시지 (있는 경우)</li>
                <li>스크린샷 또는 화면 녹화</li>
              </ol>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default BattlePage;
