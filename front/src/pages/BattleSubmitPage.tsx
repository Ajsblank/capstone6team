import React, { useState, useEffect } from "react";
import ChitoBattleProblem from "../components/ChitoBattleProblem";
import CodeEditor, { LANGUAGE_DEFAULTS } from "../components/CodeEditor";
import SubmitBar from "../components/SubmitBar";
import SubmitSuccessModal from "../components/SubmitSuccessModal";
import { submitCode } from "../api/submissionApi";
import { useApp } from "../context/AppContext";
import { Language } from "../types";

import "./BattleSubmitPage.css";


type Tab = "problem" | "submit" | "my-submissions" | "viz1" | "viz2" | "leaderboard" | "battle-results";
type SubmitStatus = "idle" | "submitting" | "success" | "error";

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
  const { navigate } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>(getTabFromHash);

  // 브라우저 뒤로가기/앞으로가기로 탭 변경 시 동기화
  useEffect(() => {
    const handleHashChange = () => setActiveTab(getTabFromHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleTabChange = (tab: Tab) => {
    window.location.hash = `submit/${tab}`;
    setActiveTab(tab);
  };
  const [language, setLanguage] = useState<Language>("cpp");
  const [code, setCode] = useState<string>(LANGUAGE_DEFAULTS["cpp"]);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [responseMessage, setResponseMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleSubmit = async () => {
    if (!code.trim()) return;
    setSubmitStatus("submitting");
    setErrorMessage("");

    try {
      const result = await submitCode({
        userId: "guest", // TODO: 로그인 구현 후 실제 유저 ID로 교체
        language: language as string,
        sourceCode: code,
      });
      setResponseMessage(result.message);
      setSubmitStatus("success");
      setShowSuccessModal(true);
    } catch (err: any) {
      setSubmitStatus("error");
      if (err.response) {
        // 서버가 응답을 반환한 경우
        setErrorMessage(`[${err.response.status}] ${err.response.data?.message ?? err.response.statusText}`);
      } else if (err.request) {
        // 서버에 요청이 닿지 않은 경우 (네트워크 오류, CORS 등)
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
        <span className="header-logo">CodeBattle</span>
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
        <button className="header-home-btn" onClick={() => navigate("home")}>
          ← 홈으로
        </button>
      </header>

      <div className="page-body">
        {/* 문제 탭 */}
        {activeTab === "problem" && (
          <div className="full-panel">
            <ChitoBattleProblem />
          </div>
        )}

        {/* 제출 탭 */}
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

        {/* 혼자서 하기 (viz2) 탭: iframe으로 HTML 게임 불러오기 */}
        {activeTab === "viz2" && (
          <div className="full-panel" style={{ height: "800px" }}> {/* 적절한 높이 지정 */}
            <iframe
              src="/chito_battle_self.html" /* public 폴더에 저장한 파일명 */
              title="Demon Tournament Game"
              width="100%"
              height="100%"
              style={{ border: "none", borderRadius: "8px", backgroundColor: "#222" }}
            />
          </div>
        )}

        {/* 로그 분석 (viz1) 탭 */}
        {activeTab === "viz1" && (
          <div className="full-panel" style={{ height: "800px" }}>
            <iframe
              src="/chito_battle_log.html"
              title="Battle Log Analysis"
              width="100%"
              height="100%"
              style={{ border: "none", borderRadius: "8px", backgroundColor: "#222" }}
            />
          </div>
        )}

        {/* 미구현 탭 */}
        {(activeTab === "my-submissions" || activeTab === "leaderboard" || activeTab === "battle-results") && (
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
