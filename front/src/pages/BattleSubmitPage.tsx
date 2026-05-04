import React, { useState, useEffect, useRef, useCallback } from "react";
import ChitoBattleProblem from "../components/ChitoBattleProblem";
import CodeEditor, { LANGUAGE_DEFAULTS } from "../components/CodeEditor";
import SubmitBar from "../components/SubmitBar";
import SubmitSuccessModal from "../components/SubmitSuccessModal";
import MySubmissionsTab from "../components/MySubmissionsTab";
import { submitCode } from "../api/codeBattleApi";
import { setMatchCallback, setSummaryCallback, BattleMatchResult, SubmissionSummary } from "../api/sseApi";
import { useApp } from "../context/AppContext";
import { Language } from "../types";
import "./BattleSubmitPage.css";

type Tab = "problem" | "submit" | "my-submissions" | "viz1" | "viz2" | "leaderboard" | "battle-results";
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
}

const TAB_LIST: { id: Tab; label: string }[] = [
  { id: "problem",        label: "문제" },
  { id: "submit",         label: "제출" },
  { id: "my-submissions", label: "내 제출" },
  { id: "viz1",           label: "로그 분석" },
  { id: "viz2",           label: "혼자서 하기" },
  { id: "leaderboard",    label: "리더보드" },
  { id: "battle-results", label: "대결 결과" },
];

const VALID_TABS: Tab[] = ["problem", "submit", "my-submissions", "viz1", "viz2", "leaderboard", "battle-results"];

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
  const { navigate, user } = useApp();

  const [{ problemId, tab: activeTab }, setHashState] = useState(parseHash);

  const [language, setLanguage] = useState<Language>("cpp");
  const [code, setCode] = useState<string>(LANGUAGE_DEFAULTS["cpp"]);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [responseMessage, setResponseMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [localSubmissions, setLocalSubmissions] = useState<LocalSubmission[]>([]);
  const [submissionsRefreshKey, setSubmissionsRefreshKey] = useState(0);

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
    // 단일 매치 결과 → 최신 제출에 실시간 누적
    setMatchCallback((result: BattleMatchResult) => {
      setLocalSubmissions(prev => {
        if (prev.length === 0) return prev;
        const [latest, ...rest] = prev;
        if (latest.finalized) return prev; // 이미 확정된 제출은 무시
        return [{ ...latest, matches: [...latest.matches, result] }, ...rest];
      });
    });

    // 모든 매치 완료 후 종합 결과 → 최신 제출을 서버 확정값으로 교체
    setSummaryCallback((summary: SubmissionSummary) => {
      setLocalSubmissions(prev => {
        if (prev.length === 0) return prev;
        const [latest, ...rest] = prev;
        return [{
          ...latest,
          submissionId: summary.submissionId,
          wins:    summary.wins,
          losses:  summary.losses,
          matches: summary.matches,
          finalized: true,
        }, ...rest];
      });
    });

    return () => {
      setMatchCallback(() => {});
      setSummaryCallback(() => {});
    };
  }, []);

  const handleTabChange = useCallback((tab: Tab) => {
    const base = problemId === 1 ? "submit" : `submit/${problemId}`;
    window.location.hash = `${base}/${tab}`;
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

    try {
      const result = await submitCode({
        userId: user?.id ?? "",
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
    <div className="submit-page">
      {showSuccessModal && (
        <SubmitSuccessModal message={responseMessage} onClose={() => setShowSuccessModal(false)} />
      )}
      <header className="page-header">
        <span className="header-logo" onClick={() => navigate("landing")}>CodeBattle</span>
        <span className="header-divider" />
        <nav className="tab-nav">
          {TAB_LIST.map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn${activeTab === tab.id ? " tab-btn--active" : ""}`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <button className="header-home-btn" onClick={() => window.history.back()}>
          ← 이전으로
        </button>
      </header>

      <div className="page-body">
        {activeTab === "problem" && (
          <div className="full-panel">
            <ChitoBattleProblem />
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
      </div>
    </div>
  );
};

export default SubmitPage;
