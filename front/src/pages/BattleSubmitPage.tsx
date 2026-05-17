import React, { useState, useEffect, useRef, useCallback } from "react";
import ContestProblemDetail from "../components/ContestProblemDetail";
import EditContestModal from "../components/EditContestModal";
import CodeEditor, { LANGUAGE_DEFAULTS } from "../components/CodeEditor";
import SubmitBar from "../components/SubmitBar";
import SubmitSuccessModal from "../components/SubmitSuccessModal";
import MySubmissionsTab from "../components/MySubmissionsTab";
import ReviewTab from "../components/ReviewTab";
import { submitCode, getContestDetail, joinContest, ContestDetail } from "../api/codeBattleApi";
import { setMatchCallback, setSummaryCallback, setReconnectCallback, BattleMatchResult, SubmissionSummary, debugSse } from "../api/sseApi";
import { useApp } from "../context/AppContext";
import { Language } from "../types";
import "./AppLayout.css";
import "./BattleHomePage.css";
import "./BattleSubmitPage.css";

type Tab = "problem" | "submit" | "my-submissions" | "viz1" | "viz2" | "leaderboard" | "battle-results" | "review";
type SubmitStatus = "idle" | "submitting" | "success" | "error";

export interface LocalSubmission {
  submissionId?: number;        // 서버 ID (SSE summary 수신 후 채워짐)
  submittedAt: Date;
  language: string;
  success: boolean;
  message: string;
  wins?: number;                // SSE summary 수신 후 확정값
  losses?: number;
  matches: BattleMatchResult[]; // SSE match-result로 실시간 누적
  finalized: boolean;           // submission-summary 수신 완료 여부
  error?: string;               // 채점 오류 메시지
}

interface TabDef { id: Tab; label: string; disabled?: boolean; tooltip?: string; }

const BASE_TAB_LIST: TabDef[] = [
  { id: "problem",        label: "문제" },
  { id: "submit",         label: "제출" },
  { id: "my-submissions", label: "내 제출" },
  { id: "viz1",           label: "로그 분석" },
  { id: "viz2",           label: "혼자서 하기" },
  { id: "leaderboard",    label: "리더보드",   disabled: true, tooltip: "준비 중인 기능입니다" },
  { id: "battle-results", label: "대결 결과",   disabled: true, tooltip: "준비 중인 기능입니다" },
];

const VALID_TABS: Tab[] = ["problem", "submit", "my-submissions", "viz1", "viz2", "leaderboard", "battle-results", "review"];

/**
 * 해시 파싱
 * 형식 A: #submit/tab          → problemId=1 (기본값)
 * 형식 B: #submit/123/tab      → problemId=123
 */
function parseHash(): { problemId: number; tab: Tab } {
  const parts = window.location.hash.replace("#", "").split("/");
  // parts[0] = "submit"
  const maybeId = Number(parts[1]);
  if (!isNaN(maybeId) && maybeId > 0) {
    const tab = (parts[2] ?? "problem") as Tab;
    return { problemId: maybeId, tab: VALID_TABS.includes(tab) ? tab : "problem" };
  }
  const tab = (parts[1] ?? "problem") as Tab;
  return { problemId: 1, tab: VALID_TABS.includes(tab) ? tab : "problem" };
}

const SubmitPage: React.FC = () => {
  const { navigate, user, logout, hostedContestIds } = useApp();

  const [{ problemId, tab: activeTab }, setHashState] = useState(parseHash);

  const isReviewer = hostedContestIds.includes(problemId);
  const TAB_LIST = isReviewer
    ? [...BASE_TAB_LIST, { id: "review" as Tab, label: "검수" }]
    : BASE_TAB_LIST;

  const [language, setLanguage] = useState<Language>("cpp");
  const [code, setCode] = useState<string>(LANGUAGE_DEFAULTS["cpp"]);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [responseMessage, setResponseMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [localSubmissions, setLocalSubmissions] = useState<LocalSubmission[]>([]);
  const [submissionsRefreshKey, setSubmissionsRefreshKey] = useState(0);
  const userIdRef = useRef(user?.id ?? "");
  useEffect(() => { userIdRef.current = user?.id ?? ""; }, [user?.id]);

  const [contestDetail, setContestDetail] = useState<ContestDetail | null>(null);
  const [contestDetailLoading, setContestDetailLoading] = useState(false);
  const [contestDetailError, setContestDetailError] = useState<string | null>(null);

  const [joinStatus, setJoinStatus] = useState<"idle" | "joining" | "joined" | "error">("idle");
  const [joinError, setJoinError] = useState("");

  const [showEditModal, setShowEditModal] = useState(false);

  // TODO: 백엔드에서 contestDetail.creatorId 반환 구현 후 아래 주석 해제
  // const isOwner = !!user && !!contestDetail && user.id === contestDetail.creatorId;
  const isOwner = false;

  // 대회 상세 조회
  useEffect(() => {
    let cancelled = false;
    setContestDetail(null);
    setContestDetailError(null);
    setContestDetailLoading(true);
    setJoinStatus("idle");
    setJoinError("");
    getContestDetail(problemId)
      .then(data => { if (!cancelled) setContestDetail(data); })
      .catch(() => { if (!cancelled) setContestDetailError("대회 정보를 불러오지 못했습니다."); })
      .finally(() => { if (!cancelled) setContestDetailLoading(false); });
    return () => { cancelled = true; };
  }, [problemId]);

  const handleJoin = useCallback(async () => {
    if (!user) {
      setJoinStatus("error");
      setJoinError("로그인이 필요합니다.");
      return;
    }
    setJoinStatus("joining");
    setJoinError("");
    try {
      await joinContest(problemId, user.email ?? user.id);
      setJoinStatus("joined");
    } catch (err: any) {
      setJoinStatus("error");
      setJoinError(err.response?.data?.message ?? "참가 신청에 실패했습니다.");
    }
  }, [problemId, user]);

  // 로그 분석 iframe ref + 전달할 로그
  const logIframeRef = useRef<HTMLIFrameElement>(null);
  const [pendingLog, setPendingLog] = useState<string | null>(null);

  // 해시 변경 감지
  useEffect(() => {
    const handleHashChange = () => setHashState(parseHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // SSE 콜백 등록
  useEffect(() => {
    console.log("[BattleSubmitPage] SSE 콜백 등록 (mount)");

    setReconnectCallback(() => {
      console.log("[BattleSubmitPage] SSE 재연결 감지 → 서버 재조회");
      setSubmissionsRefreshKey(k => k + 1);
    });

    // 단일 매치 결과 → 최신 제출에 실시간 누적
    setMatchCallback((raw: BattleMatchResult) => {
      console.log("[BattleSubmitPage] match-result 콜백 호출:", raw);
      // 백엔드 포맷 { aiId, status, log } → 프론트 포맷 { matchId, winner, log } 정규화
      const r = raw as any;
      const result: BattleMatchResult = ("status" in r)
        ? {
            matchId: r.aiId ?? r.matchId ?? 0,
            winner:  r.status === "WIN"  ? userIdRef.current
                   : r.status === "DRAW" ? "draw"
                   : "ai",
            log: r.log ?? "",
          }
        : raw;
      setLocalSubmissions(prev => {
        if (prev.length === 0) {
          console.warn("[BattleSubmitPage] match-result 수신 — 로컬 제출 없음, 무시");
          return prev;
        }
        const [latest, ...rest] = prev;
        if (latest.finalized) {
          console.warn("[BattleSubmitPage] match-result 수신 — 최신 제출 이미 확정됨, 무시");
          return prev;
        }
        if (latest.matches.some(m => m.matchId === result.matchId)) {
          console.warn("[BattleSubmitPage] 중복 match-result 무시 — matchId:", result.matchId);
          return prev;
        }
        console.log("[BattleSubmitPage] matches 누적 →", latest.matches.length + 1, "건");
        return [{ ...latest, matches: [...latest.matches, result] }, ...rest];
      });
    });

    // 모든 매치 완료 후 종합 결과 → 최신 제출을 서버 확정값으로 교체
    setSummaryCallback((summary: SubmissionSummary) => {
      console.log("[BattleSubmitPage] submission-summary 콜백 호출:", summary);
      setLocalSubmissions(prev => {
        if (prev.length === 0) {
          console.warn("[BattleSubmitPage] summary 수신 — 로컬 제출 없음, 무시");
          return prev;
        }
        const [latest, ...rest] = prev;
        // summary.matches가 없으면 기존 SSE match-result로 누적된 matches 유지
        const finalMatches = Array.isArray(summary.matches) && summary.matches.length > 0
          ? summary.matches
          : latest.matches;
        console.log("[BattleSubmitPage] 제출 확정 — submissionId:", summary.submissionId,
          "wins:", summary.wins, "losses:", summary.losses, "matches:", finalMatches.length);
        return [{
          ...latest,
          submissionId: summary.submissionId,
          wins:    summary.wins,
          losses:  summary.losses,
          matches: finalMatches,
          finalized: true,
        }, ...rest];
      });
      // SSE 완료 후 서버에서 최신 제출 목록 재조회 (race condition 해소)
      setSubmissionsRefreshKey(k => k + 1);
    });

    return () => {
      console.log("[BattleSubmitPage] SSE 콜백 해제 (unmount)");
      setMatchCallback(() => {});
      setSummaryCallback(() => {});
      setReconnectCallback(null);
    };
  }, []);

  const handleTabChange = useCallback((tab: Tab) => {
    window.location.hash = `submit/${problemId}/${tab}`;
    setHashState(prev => ({ ...prev, tab }));
    if (tab === "my-submissions") setSubmissionsRefreshKey(k => k + 1);
  }, [problemId]);

  // 로그 클릭 → viz1 탭으로 이동 후 iframe에 로그 전달
  const handleLogClick = useCallback((log: string) => {
    setPendingLog(log);
    handleTabChange("viz1");
  }, [handleTabChange]);

  // iframe 로드 완료 시 pendingLog postMessage 전송
  const handleIframeLoad = useCallback(() => {
    if (pendingLog !== null && logIframeRef.current?.contentWindow) {
      setTimeout(() => {
        logIframeRef.current?.contentWindow?.postMessage(
          { type: "LOAD_LOG", log: pendingLog },
          "*"
        );
      }, 100);
      setPendingLog(null);
    }
  }, [pendingLog]);

  const handleSubmit = async () => {
    if (!code.trim()) return;
    const submittedAt = new Date();
    setSubmitStatus("submitting");
    setErrorMessage("");

    // SSE 구독 userId vs 제출 userId 비교 로그
    const submitUserId = user?.id ?? "";
    debugSse();
    console.log("[BattleSubmitPage] 제출 userId:", submitUserId, "/ contestId(problemId):", problemId);

    try {
      const result = await submitCode({
        userId: submitUserId,
        problemId: String(problemId),
        language: language.toUpperCase(),
        sourceCode: code,
      });
      setLocalSubmissions(prev => [{
        submittedAt,
        language,
        success: result.success,
        message: result.message,
        matches: [],
        finalized: false,
      }, ...prev]);
      setResponseMessage(result.message);
      setSubmitStatus("success");
      setShowSuccessModal(true);
    } catch (err: any) {
      setSubmitStatus("error");
      if (err.response) {
        setErrorMessage(`[${err.response.status}] ${err.response.data?.message ?? err.response.statusText}`);
      } else if (err.request) {
        setErrorMessage("서버에 연결할 수 없습니다. 네트워크 또는 CORS를 확인하세요.");
      } else {
        setErrorMessage(err.message ?? "알 수 없는 오류가 발생했습니다.");
      }
    }
  };

  return (
    <div className="submit-page home-page battle-home-page">
      {showSuccessModal && (
        <SubmitSuccessModal
          message={responseMessage}
          onClose={() => {
            setShowSuccessModal(false);
            handleTabChange("my-submissions");
          }}
        />
      )}

      {showEditModal && contestDetail && (
        <EditContestModal
          contestId={problemId}
          initial={contestDetail}
          onClose={() => setShowEditModal(false)}
          onSaved={updated => setContestDetail(prev => prev ? { ...prev, ...updated } : prev)}
        />
      )}

      {/* 메인 헤더 — BattleHomePage와 동일 */}
      <header className="home-header">
        <span className="home-logo" onClick={() => navigate("landing")}>
          <img src="/resources/logo/TacticalCodeBattle_logo.png" alt="TCB" className="home-logo-img" />
        </span>
        <nav className="home-tab-nav">
          <button className="home-tab-btn home-tab-btn--active" onClick={() => { window.location.hash = "battle/contest"; }}>대회</button>
          <button className="home-tab-btn home-tab-btn--disabled" title="준비 중인 기능입니다">랭킹</button>
          <button className="home-tab-btn home-tab-btn--disabled" title="준비 중인 기능입니다">도움말</button>
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
                localStorage.setItem("loginRedirect", window.location.hash.replace("#", "") || "battle/contest");
                navigate("login");
              }}>로그인</button>
            </>
          )}
        </div>
      </header>

      {/* 문제 제목 바 */}
      <div className="sp-problem-bar">
        <button className="sp-back-btn" onClick={() => navigate("battle")}>← 대회 목록</button>
        <span className="sp-problem-bar-divider" />
        <span className="sp-problem-title">
          {contestDetailLoading ? "불러오는 중..." : (contestDetail?.title ?? "대회")}
        </span>
      </div>

      {/* 서브탭 */}
      <div className="sp-sub-tab-bar">
        {TAB_LIST.map((tab) => (
          <button
            key={tab.id}
            className={`sp-sub-tab-btn${activeTab === tab.id ? " sp-sub-tab-btn--active" : ""}${tab.disabled ? " sp-sub-tab-btn--disabled" : ""}`}
            title={tab.tooltip}
            onClick={tab.disabled ? undefined : () => handleTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="page-body">
        {activeTab === "problem" && (
          <div className="full-panel">
            <ContestProblemDetail
              detail={contestDetail}
              loading={contestDetailLoading}
              error={contestDetailError}
              onJoin={handleJoin}
              joinStatus={joinStatus}
              joinError={joinError}
              onEdit={isOwner ? () => setShowEditModal(true) : undefined}
            />
          </div>
        )}

        {activeTab === "submit" && (
          <div className="code-submit-panel">
            <div className="editor-panel">
              <CodeEditor
                language={language}
                code={code}
                onLanguageChange={setLanguage}
                onCodeChange={setCode}
              />
              <SubmitBar status={submitStatus} errorMessage={errorMessage} onSubmit={handleSubmit} />
            </div>
          </div>
        )}

        {activeTab === "my-submissions" && (
          <div className="full-panel" style={{ overflowY: "auto" }}>
            <MySubmissionsTab
              contestId={problemId}
              refreshKey={submissionsRefreshKey}
              localSubmissions={localSubmissions}
              onLocalUpdate={setLocalSubmissions}
              onLogClick={handleLogClick}
              userId={user?.id ?? ""}
            />
          </div>
        )}

        {/* viz1: 로그 분석 — pendingLog를 iframe에 postMessage로 전달 */}
        {activeTab === "viz1" && (
          <div className="full-panel" style={{ height: "800px" }}>
            <iframe
              ref={logIframeRef}
              src="/chito_battle_log.html"
              title="Battle Log Analysis"
              width="100%"
              height="100%"
              style={{ border: "none", borderRadius: "8px", backgroundColor: "#222" }}
              onLoad={handleIframeLoad}
            />
          </div>
        )}

        {activeTab === "viz2" && (
          <div className="full-panel" style={{ height: "800px" }}>
            <iframe
              src="/chito_battle_self.html"
              title="Demon Tournament Game"
              width="100%"
              height="100%"
              style={{ border: "none", borderRadius: "8px", backgroundColor: "#222" }}
            />
          </div>
        )}

        {(activeTab === "leaderboard" || activeTab === "battle-results") && (
          <div className="placeholder-panel">
            <span className="placeholder-text">
              {TAB_LIST.find((t) => t.id === activeTab)?.label} — 준비 중입니다.
            </span>
          </div>
        )}

        {activeTab === "review" && isReviewer && (
          <div className="full-panel" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <ReviewTab contestId={problemId} />
          </div>
        )}
      </div>
    </div>
  );
};

export default SubmitPage;
