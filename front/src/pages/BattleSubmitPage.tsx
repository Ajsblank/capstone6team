import React, { useState, useEffect, useRef, useCallback } from "react";
import ChitoBattleProblem from "../components/ChitoBattleProblem";
import CodeEditor, { LANGUAGE_DEFAULTS } from "../components/CodeEditor";
import SubmitBar from "../components/SubmitBar";
import SubmitSuccessModal from "../components/SubmitSuccessModal";
import MySubmissionsTab from "../components/MySubmissionsTab";
import { submitCode } from "../api/codeBattleApi";
import { setMatchCallback } from "../api/sseApi";
import { BattleMatchResult } from "../api/sseApi";
import { useApp } from "../context/AppContext";
import { Language } from "../types";
import "./BattleSubmitPage.css";

type Tab = "problem" | "submit" | "my-submissions" | "viz1" | "viz2" | "leaderboard" | "battle-results";
type SubmitStatus = "idle" | "submitting" | "success" | "error";

export interface LocalSubmission {
  submittedAt: Date;
  language: string;
  success: boolean;
  message: string;
  matches: BattleMatchResult[]; // SSE로 실시간 누적
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

function getTabFromHash(): Tab {
  const sub = window.location.hash.replace("#", "").split("/")[1] as Tab;
  return VALID_TABS.includes(sub) ? sub : "problem";
}

const SubmitPage: React.FC = () => {
  const { navigate, user } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>(getTabFromHash);

  const [language, setLanguage] = useState<Language>("cpp");
  const [code, setCode] = useState<string>(LANGUAGE_DEFAULTS["cpp"]);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [responseMessage, setResponseMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [localSubmissions, setLocalSubmissions] = useState<LocalSubmission[]>([]);

  // 로그 분석 iframe ref + 전달할 로그
  const logIframeRef = useRef<HTMLIFrameElement>(null);
  const [pendingLog, setPendingLog] = useState<string | null>(null);

  // 해시 변경 감지
  useEffect(() => {
    const handleHashChange = () => setActiveTab(getTabFromHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // SSE 콜백 등록 — 이 페이지가 마운트 되어 있는 동안 매치 결과를 최신 제출에 누적
  useEffect(() => {
    setMatchCallback((result: BattleMatchResult) => {
      setLocalSubmissions(prev => {
        if (prev.length === 0) return prev;
        const [latest, ...rest] = prev;
        return [{ ...latest, matches: [...latest.matches, result] }, ...rest];
      });
    });
    return () => {
      setMatchCallback(() => {}); // 언마운트 시 콜백 해제
    };
  }, []);

  const handleTabChange = useCallback((tab: Tab) => {
    window.location.hash = `submit/${tab}`;
    setActiveTab(tab);
  }, []);

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
        language: language as string,
        sourceCode: code,
      });
      setLocalSubmissions(prev => [{
        submittedAt,
        language,
        success: result.success,
        message: result.message,
        matches: [],
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
        <span className="header-logo" onClick={() => navigate("battle")}>CodeBattle</span>
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
        <button className="header-home-btn" onClick={() => navigate("battle")}>
          ← 홈으로
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
              localSubmissions={localSubmissions}
              onLogClick={handleLogClick}
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
