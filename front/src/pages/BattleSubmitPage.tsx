import React, { useState, useEffect, useRef, useCallback } from "react";
import ContestProblemDetail from "../components/ContestProblemDetail";
import EditContestModal from "../components/EditContestModal";
import CodeEditor, { LANGUAGE_DEFAULTS } from "../components/CodeEditor";
import SubmitBar from "../components/SubmitBar";
import SubmitSuccessModal from "../components/SubmitSuccessModal";
import MySubmissionsTab from "../components/MySubmissionsTab";
import ReviewTab from "../components/ReviewTab";
import BattleSessionsTab from "../components/BattleSessionsTab";
import SessionDetailPanel from "../components/SessionDetailPanel";
import FinalResultTab from "../components/FinalResultTab";
import LeaderboardTab from "../components/LeaderboardTab";
import Breadcrumb from "../components/Breadcrumb";
import { submitCode, getContestDetail, joinContest, ContestDetail } from "../api/codeBattleApi";
import { setMatchCallback, setSummaryCallback, setReconnectCallback, BattleMatchResult, SubmissionSummary, debugSse } from "../api/sseApi";
import { useApp } from "../context/AppContext";
import BattleTopNav from "../components/BattleTopNav";
import { Language } from "../types";
import "./AppLayout.css";
import "./BattleHomePage.css";
import "./BattleSubmitPage.css";

type Tab = "problem" | "submit" | "my-submissions" | "viz1" | "viz2" | "leaderboard" | "battle-results" | "final-result" | "review";
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

interface TabDef { id: Tab; label: string; disabled?: boolean; unavailable?: boolean; tooltip?: string; }

const BASE_TAB_LIST: TabDef[] = [
  { id: "problem",        label: "문제" },
  { id: "submit",         label: "제출" },
  { id: "my-submissions", label: "내 제출" },
  { id: "viz1",           label: "로그 분석" },
  { id: "viz2",           label: "혼자서 하기" },
  { id: "leaderboard",    label: "리더보드" },
  { id: "battle-results", label: "중간 결과" },
  { id: "final-result",   label: "최종 결과" },
];

// 참가해야만 이용 가능한 탭 — 제출/내 제출만 제한. 나머지(문제·로그분석·혼자하기·리더보드·중간/최종 결과)는 미참가자도 조회 가능.
const PARTICIPATION_REQUIRED_TABS: Tab[] = ["submit", "my-submissions"];
const REVIEWER_ALLOWED_TABS: Tab[] = ["problem", "review", "battle-results", "final-result"];

const VALID_TABS: Tab[] = ["problem", "submit", "my-submissions", "viz1", "viz2", "leaderboard", "battle-results", "final-result", "review"];

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
  const { navigate, user, joinedContestIds, hostedContestIds, addJoinedContest } = useApp();

  const [{ problemId, tab: activeTab }, setHashState] = useState(parseHash);

  const isReviewer = hostedContestIds.includes(problemId);

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

  const [joinStatus, setJoinStatus] = useState<"idle" | "joining" | "joined" | "error">(
    () => joinedContestIds.includes(problemId) ? "joined" : "idle"
  );
  const [joinError, setJoinError] = useState("");

  // contestDetail 로드 전(null)에는 탭 비활성화하지 않음
  const viz1Available = !contestDetail || !!contestDetail.visualizationHtml?.trim();
  const viz2Available = !contestDetail || !!contestDetail.soloPlayHtml?.trim();

  const isJoined = joinedContestIds.includes(problemId) || joinStatus === "joined";

  const isContestEnded = contestDetail?.status === "END";

  const TAB_LIST: TabDef[] = [
    ...BASE_TAB_LIST,
    ...(isReviewer ? [{ id: "review" as Tab, label: "검수" }] : []),
  ].map(tab => {
    if (isReviewer && !REVIEWER_ALLOWED_TABS.includes(tab.id))
      return { ...tab, disabled: true, tooltip: "검수자는 이용할 수 없습니다" };
    // 종료된 대회는 제출/내 제출 탭 활성화 (결과 조회 허용)
    if (!tab.disabled && !isJoined && !isContestEnded && PARTICIPATION_REQUIRED_TABS.includes(tab.id))
      return { ...tab, disabled: true, tooltip: "대회에 참가 후 이용 가능합니다" };
    if (tab.id === "viz1" && !viz1Available)
      return { ...tab, unavailable: true, tooltip: "콘텐츠가 준비되지 않았습니다" };
    if (tab.id === "viz2" && !viz2Available)
      return { ...tab, unavailable: true, tooltip: "콘텐츠가 준비되지 않았습니다" };
    return tab;
  });

  const [showEditModal, setShowEditModal]       = useState(false);
  const [selectedSession, setSelectedSession]   = useState<number | null>(null);
  const [showLoginPopup, setShowLoginPopup]     = useState(false);

  // TODO: 백엔드에서 contestDetail.creatorId 반환 구현 후 아래 주석 해제
  // const isOwner = !!user && !!contestDetail && user.id === contestDetail.creatorId;
  const isOwner = false;

  // 대회 상세 조회
  useEffect(() => {
    let cancelled = false;
    setContestDetail(null);
    setContestDetailError(null);
    setContestDetailLoading(true);
    setJoinStatus(joinedContestIds.includes(problemId) ? "joined" : "idle");
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
      addJoinedContest(problemId);
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

  // 검수자가 허용되지 않은 탭에 직접 접근 시 문제 탭으로 이동
  useEffect(() => {
    if (isReviewer && !REVIEWER_ALLOWED_TABS.includes(activeTab)) {
      window.location.hash = `submit/${problemId}/problem`;
      setHashState(prev => ({ ...prev, tab: "problem" }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReviewer]);

  // 미참가 상태에서 잠긴 탭 직접 접근 시 문제 탭으로 이동
  useEffect(() => {
    if (!isReviewer && !isJoined && PARTICIPATION_REQUIRED_TABS.includes(activeTab)) {
      window.location.hash = `submit/${problemId}/problem`;
      setHashState(prev => ({ ...prev, tab: "problem" }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isJoined]);

  // 콘텐츠 없는 탭 직접 접근 시 문제 탭으로 이동
  useEffect(() => {
    if (!contestDetail) return;
    if ((activeTab === "viz1" && !contestDetail.visualizationHtml?.trim()) ||
        (activeTab === "viz2" && !contestDetail.soloPlayHtml?.trim())) {
      window.location.hash = `submit/${problemId}/problem`;
      setHashState(prev => ({ ...prev, tab: "problem" }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestDetail]);

  const handleTabChange = useCallback((tab: Tab) => {
    // 중간 결과 탭 떠날 때 세션 선택 초기화
    if (activeTab === "battle-results") setSelectedSession(null);
    // 제출 탭 떠날 때 상태 텍스트 초기화 (코드는 유지)
    if (activeTab === "submit") { setSubmitStatus("idle"); setErrorMessage(""); }

    window.location.hash = `submit/${problemId}/${tab}`;
    setHashState(prev => ({ ...prev, tab }));
    if (tab === "my-submissions") setSubmissionsRefreshKey(k => k + 1);
  }, [problemId, activeTab]);

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
      {/* ── 로그인 필요 팝업 ── */}
      {showLoginPopup && (
        <div className="bp-popup-overlay" onClick={() => setShowLoginPopup(false)}>
          <div className="bp-popup" onClick={e => e.stopPropagation()}>
            <p className="bp-popup-msg">로그인이 필요한 기능입니다.<br />로그인하러 이동하시겠습니까?</p>
            <button className="bp-popup-btn" onClick={() => { setShowLoginPopup(false); navigate("login"); }}>
              이동
            </button>
          </div>
        </div>
      )}

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
      <BattleTopNav saveLoginRedirect />

      {/* 문제 제목 바 */}
      <div className="sp-problem-bar">
        <Breadcrumb items={[
          { label: "대회 목록", onClick: () => navigate("battle") },
          { label: contestDetailLoading ? "..." : (contestDetail?.title ?? "대회") },
        ]} />
      </div>

      {/* 서브탭 */}
      <div className="sp-sub-tab-bar">
        {TAB_LIST.map((tab) => (
          <button
            key={tab.id}
            className={[
              "sp-sub-tab-btn",
              activeTab === tab.id ? "sp-sub-tab-btn--active" : "",
              tab.disabled    ? "sp-sub-tab-btn--disabled"    : "",
              tab.unavailable ? "sp-sub-tab-btn--unavailable" : "",
            ].filter(Boolean).join(" ")}
            title={tab.tooltip}
            onClick={
              tab.unavailable ? undefined
              : tab.disabled ? undefined
              : !user && PARTICIPATION_REQUIRED_TABS.includes(tab.id) ? () => setShowLoginPopup(true)
              : () => handleTabChange(tab.id)
            }
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
              isReviewer={isReviewer}
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
              hasVisualization={viz1Available}
            />
          </div>
        )}

        {/* viz1: 로그 분석 — pendingLog를 iframe에 postMessage로 전달 */}
        {activeTab === "viz1" && contestDetail?.visualizationHtml && (
          <div className="full-panel" style={{ height: "800px" }}>
            <iframe
              ref={logIframeRef}
              srcDoc={contestDetail.visualizationHtml}
              title="Battle Log Analysis"
              width="100%"
              height="100%"
              style={{ border: "none", borderRadius: "8px", backgroundColor: "#222" }}
              onLoad={handleIframeLoad}
            />
          </div>
        )}

        {activeTab === "viz2" && contestDetail?.soloPlayHtml && (
          <div className="full-panel" style={{ height: "800px" }}>
            <iframe
              srcDoc={contestDetail.soloPlayHtml}
              title="Demon Tournament Game"
              width="100%"
              height="100%"
              style={{ border: "none", borderRadius: "8px", backgroundColor: "#222" }}
            />
          </div>
        )}

        {activeTab === "leaderboard" && (
          <div className="full-panel" style={{ overflowY: "auto" }}>
            <LeaderboardTab
              contestId={problemId}
              myUserId={user?.id ? Number(user.id) : undefined}
              hasVisualization={viz1Available}
              onLogView={handleLogClick}
            />
          </div>
        )}

        {activeTab === "final-result" && (
          <div className="full-panel" style={{ overflowY: "auto" }}>
            <FinalResultTab
              contestId={problemId}
              myUserId={user?.id ? Number(user.id) : undefined}
              hasVizHtml={viz1Available}
              onLogView={handleLogClick}
            />
          </div>
        )}

        {activeTab === "battle-results" && (
          <div className="full-panel" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {selectedSession === null ? (
              <BattleSessionsTab
                contestId={problemId}
                onSessionClick={setSelectedSession}
                contestEnded={contestDetail?.status === "END"}
              />
            ) : (
              <SessionDetailPanel
                contestId={problemId}
                sessionNumber={selectedSession}
                onBack={() => setSelectedSession(null)}
                myUserId={user?.id ? Number(user.id) : undefined}
                hasVisualization={viz1Available}
                onLogView={handleLogClick}
              />
            )}
          </div>
        )}

        {activeTab === "review" && isReviewer && (
          <div className="full-panel" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <ReviewTab contestId={problemId} onLogClick={handleLogClick} />
          </div>
        )}
      </div>
    </div>
  );
};

export default SubmitPage;
