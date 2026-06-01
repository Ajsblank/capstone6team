import React, { useState, useEffect } from "react";
import CodeEditor, { LANGUAGE_DEFAULTS } from "./CodeEditor";
import { Language } from "../types";
import { ContestStatus } from "../api/contestApi";
import "../pages/BattleSubmitPage.css";
import "./ChitoBattleProblem.css";

type PreviewTab =
  | "problem" | "submit" | "my-submissions"
  | "viz1" | "viz2" | "leaderboard"
  | "battle-results" | "final-result";

interface Props {
  title: string;
  description: string;
  timeLimitSec: number;
  memoryLimitMb: number;
  maxParticipants: number;
  certification: boolean;
  status: ContestStatus;
  startDate: string;
  endDate: string;
  visualizationHtml: File | null;
  soloPlayHtml: File | null;
  onClose: () => void;
}

const TABS: { id: PreviewTab; label: string }[] = [
  { id: "problem",        label: "문제" },
  { id: "submit",         label: "제출" },
  { id: "my-submissions", label: "내 제출" },
  { id: "viz1",           label: "로그 분석" },
  { id: "viz2",           label: "혼자서 하기" },
  { id: "leaderboard",    label: "리더보드" },
  { id: "battle-results", label: "중간 결과" },
  { id: "final-result",   label: "최종 결과" },
];

const STATUS_LABELS: Record<string, string> = {
  TEST: "테스트", PLANNED: "예정", RUNNING: "진행 중", PAUSED: "일시 정지", END: "종료",
};

function formatDateTime(s: string): string {
  if (!s) return "-";
  return new Date(s).toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function isDescEmpty(html: string): boolean {
  return !html || html === "<p></p>" || html.replace(/<[^>]*>/g, "").trim() === "";
}

const ContestPreviewModal: React.FC<Props> = ({
  title, description, timeLimitSec, memoryLimitMb, maxParticipants,
  certification, status, startDate, endDate,
  visualizationHtml, soloPlayHtml, onClose,
}) => {
  const [activeTab, setActiveTab] = useState<PreviewTab>("problem");
  const [language, setLanguage] = useState<Language>("cpp");
  const [code, setCode] = useState<string>(LANGUAGE_DEFAULTS["cpp"]);
  const [vizHtmlContent, setVizHtmlContent] = useState<string | null>(null);
  const [soloHtmlContent, setSoloHtmlContent] = useState<string | null>(null);

  useEffect(() => {
    if (visualizationHtml) visualizationHtml.text().then(setVizHtmlContent);
    else setVizHtmlContent(null);
    if (soloPlayHtml) soloPlayHtml.text().then(setSoloHtmlContent);
    else setSoloHtmlContent(null);
  }, [visualizationHtml, soloPlayHtml]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const viz1Available = !!vizHtmlContent;
  const viz2Available = !!soloHtmlContent;

  // viz 탭 선택 시 파일이 없으면 problem으로 돌아가지 않도록 탭 비활성 처리
  const isTabUnavailable = (id: PreviewTab) =>
    (id === "viz1" && !viz1Available) || (id === "viz2" && !viz2Available);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "#ffffff",
      display: "flex", flexDirection: "column",
      fontFamily: '"IBM Plex Sans KR", "IBM Plex Sans", sans-serif',
    }}>
      {/* 미리보기 알림 바 */}
      <div style={{
        background: "#fff7ed",
        borderBottom: "2px solid #fed7aa",
        padding: "7px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0, gap: 12,
      }}>
        <span style={{
          fontSize: "0.75rem", fontWeight: 700,
          color: "#ea580c", letterSpacing: "0.05em",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span style={{ opacity: 0.7 }}>👁</span> 미리보기 모드 — 실제 대회 페이지와 동일한 구조입니다
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none", border: "1px solid #fed7aa",
            borderRadius: 6, color: "#ea580c",
            fontSize: "0.78rem", fontWeight: 600,
            padding: "4px 14px", cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          닫기 ✕
        </button>
      </div>

      {/* 문제 제목 바 */}
      <div className="sp-problem-bar">
        <span style={{ color: "#9ca3af", fontSize: "0.82rem" }}>대회 목록</span>
        <span style={{ color: "#d1d5db", margin: "0 10px", fontSize: "0.82rem" }}>/</span>
        <span style={{ fontSize: "1rem", fontWeight: 800, color: "#c2410c", letterSpacing: "-0.01em" }}>
          {title || "(제목 없음)"}
        </span>
      </div>

      {/* 서브탭 바 */}
      <div className="sp-sub-tab-bar">
        {TABS.map(tab => {
          const unavailable = isTabUnavailable(tab.id);
          return (
            <button
              key={tab.id}
              className={[
                "sp-sub-tab-btn",
                activeTab === tab.id ? "sp-sub-tab-btn--active" : "",
                unavailable ? "sp-sub-tab-btn--unavailable" : "",
              ].filter(Boolean).join(" ")}
              title={unavailable ? "파일이 첨부되지 않았습니다" : undefined}
              onClick={unavailable ? undefined : () => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="page-body">

        {/* ── 문제 탭 ── */}
        {activeTab === "problem" && (
          <div className="full-panel" style={{ overflowY: "auto" }}>
            <div className="prob">
              <div className="prob-header">
                <h1 className="prob-title">{title || "(제목 없음)"}</h1>
              </div>
              <section className="prob-section">
                <h2>대회 정보</h2>
                <table className="prob-table" style={{ maxWidth: 520 }}>
                  <tbody>
                    <tr><td style={{ fontWeight: 700, width: 130, whiteSpace: "nowrap" }}>상태</td><td>{STATUS_LABELS[status] ?? status}</td></tr>
                    <tr><td style={{ fontWeight: 700 }}>시작 일시</td><td>{formatDateTime(startDate)}</td></tr>
                    <tr><td style={{ fontWeight: 700 }}>종료 일시</td><td>{formatDateTime(endDate)}</td></tr>
                    <tr><td style={{ fontWeight: 700 }}>시간 제한</td><td>{timeLimitSec}초/턴</td></tr>
                    <tr><td style={{ fontWeight: 700 }}>메모리 제한</td><td>{memoryLimitMb} MB</td></tr>
                    <tr><td style={{ fontWeight: 700 }}>최대 참가자</td><td>{maxParticipants}명</td></tr>
                    <tr><td style={{ fontWeight: 700 }}>인증 대회</td><td>{certification ? "예" : "아니오"}</td></tr>
                  </tbody>
                </table>
              </section>

              {!isDescEmpty(description) ? (
                <section className="prob-section">
                  <h2>문제 설명</h2>
                  <div className="prob-md" dangerouslySetInnerHTML={{ __html: description }} />
                </section>
              ) : (
                <section className="prob-section">
                  <h2>문제 설명</h2>
                  <p style={{ color: "#9ca3af", fontSize: "0.9rem" }}>아직 문제 설명이 작성되지 않았습니다.</p>
                </section>
              )}
            </div>
          </div>
        )}

        {/* ── 제출 탭 ── */}
        {activeTab === "submit" && (
          <div className="code-submit-panel">
            <div className="editor-panel">
              <CodeEditor
                language={language}
                code={code}
                onLanguageChange={setLanguage}
                onCodeChange={setCode}
              />
              <div style={{
                padding: "10px 16px",
                borderTop: "1px solid #e5e7eb",
                background: "#f9fafb",
                display: "flex", alignItems: "center", gap: 12,
                flexShrink: 0,
              }}>
                <button
                  disabled
                  style={{
                    background: "#e5e7eb", color: "#9ca3af",
                    border: "none", borderRadius: 7,
                    padding: "9px 28px", fontWeight: 600,
                    fontSize: "0.9rem", cursor: "not-allowed",
                    fontFamily: "inherit",
                  }}
                >
                  제출
                </button>
                <span style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
                  미리보기 모드에서는 실제 제출이 불가합니다.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── 로그 분석 탭 ── */}
        {activeTab === "viz1" && (
          <div className="full-panel">
            {vizHtmlContent ? (
              <iframe
                srcDoc={vizHtmlContent}
                title="Battle Log Analysis"
                width="100%"
                height="100%"
                style={{ border: "none", display: "block", background: "#222" }}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#9ca3af", fontSize: "0.9rem" }}>
                시각화 HTML 파일을 첨부하면 여기서 미리볼 수 있습니다.
              </div>
            )}
          </div>
        )}

        {/* ── 혼자서 하기 탭 ── */}
        {activeTab === "viz2" && (
          <div className="full-panel">
            {soloHtmlContent ? (
              <iframe
                srcDoc={soloHtmlContent}
                title="Solo Play"
                width="100%"
                height="100%"
                style={{ border: "none", display: "block", background: "#222" }}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#9ca3af", fontSize: "0.9rem" }}>
                혼자서 하기 HTML 파일을 첨부하면 여기서 미리볼 수 있습니다.
              </div>
            )}
          </div>
        )}

        {/* ── 플레이스홀더 탭 ── */}
        {(activeTab === "my-submissions" || activeTab === "leaderboard" || activeTab === "battle-results" || activeTab === "final-result") && (
          <div className="placeholder-panel">
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "1.6rem", opacity: 0.3 }}>🔒</span>
              <span className="placeholder-text">
                {activeTab === "my-submissions" && "내 제출 목록은 실제 대회 진행 중에 표시됩니다."}
                {activeTab === "leaderboard"    && "리더보드는 실제 대회 진행 중에 표시됩니다."}
                {activeTab === "battle-results" && "중간 결과는 세션이 진행된 후 확인할 수 있습니다."}
                {activeTab === "final-result"   && "최종 결과는 대회 종료 후 확인할 수 있습니다."}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContestPreviewModal;
