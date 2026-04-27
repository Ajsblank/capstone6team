import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useApp } from "../context/AppContext";
import { createContest } from "../api/contestApi";
import "./AppLayout.css";
import "./BattleCreateContestPage.css";

// ── Required asterisk ──
const Req: React.FC<{ show: boolean }> = ({ show }) =>
  show ? <span className="cc-required">*</span> : null;

// ── Toast ──
interface ToastProps { messages: string[]; onClose: () => void; }
const Toast: React.FC<ToastProps> = ({ messages, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="cc-toast">
      <span className="cc-toast-icon">⚠</span>
      <div className="cc-toast-body">
        <strong>필수 항목을 입력해주세요</strong>
        <ul className="cc-toast-list">
          {messages.map((m) => <li key={m}>{m}</li>)}
        </ul>
      </div>
      <button className="cc-toast-close" onClick={onClose}>✕</button>
    </div>
  );
};

// ── Markdown editor ──
interface MdEditorProps {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}
const MdEditor: React.FC<MdEditorProps> = ({ value, onChange, rows = 6, placeholder }) => {
  const [tab, setTab] = useState<"write" | "preview">("write");
  return (
    <div className="cc-md-editor">
      <div className="cc-md-tabs">
        <button
          type="button"
          className={`cc-md-tab${tab === "write" ? " cc-md-tab--active" : ""}`}
          onClick={() => setTab("write")}
        >
          편집
        </button>
        <button
          type="button"
          className={`cc-md-tab${tab === "preview" ? " cc-md-tab--active" : ""}`}
          onClick={() => setTab("preview")}
        >
          미리보기
        </button>
      </div>
      {tab === "write" ? (
        <textarea
          className="cc-md-textarea"
          rows={rows}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : value.trim() ? (
        <div className="cc-md-preview">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
        </div>
      ) : (
        <div className="cc-md-empty">미리볼 내용이 없습니다.</div>
      )}
    </div>
  );
};

// ── File input ──
interface FileInputProps {
  label: string;
  required?: boolean;
  accept?: string;
  value: File | null;
  onChange: (f: File | null) => void;
}
const FileInput: React.FC<FileInputProps> = ({ label, required, accept, value, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="cc-field">
      <label className="cc-label">
        {label}
        {required && <Req show={!value} />}
      </label>
      <div className="cc-file-row">
        <button
          type="button"
          className="cc-file-btn"
          onClick={() => inputRef.current?.click()}
        >
          파일 선택
        </button>
        <span className={`cc-file-name${!value ? " cc-file-name--empty" : ""}`}>
          {value ? value.name : "선택된 파일 없음"}
        </span>
        {value && (
          <button
            type="button"
            className="cc-file-clear"
            onClick={() => {
              onChange(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            ✕
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
};

// ── Page ──
const BattleCreateContestPage: React.FC = () => {
  const { user, logout, navigate } = useApp();

  const [title, setTitle] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [description, setDescription] = useState("");
  const [timeLimitSec, setTimeLimitSec] = useState<number>(1);
  const [memoryLimitMb, setMemoryLimitMb] = useState<number>(256);
  const [exampleCode, setExampleCode] = useState<File | null>(null);
  const [judgeCode, setJudgeCode] = useState<File | null>(null);
  const [visualizationHtml, setVisualizationHtml] = useState<File | null>(null);
  const [soloPlayHtml, setSoloPlayHtml] = useState<File | null>(null);
  const [problemMd, setProblemMd] = useState<File | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxParticipants, setMaxParticipants] = useState<number>(100);
  const [certification, setCertification] = useState<boolean | null>(null);

  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [toastMessages, setToastMessages] = useState<string[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleSubmit = async () => {
    const missing: string[] = [];
    if (!title.trim())          missing.push("대회 이름");
    if (!targetAudience.trim()) missing.push("참가 대상");
    if (!description.trim())    missing.push("문제 설명");
    if (!exampleCode)           missing.push("샘플 코드");
    if (!judgeCode)             missing.push("채점 코드");
    if (!visualizationHtml)     missing.push("시각화 HTML 파일");
    if (!problemMd)             missing.push("문제 명세 MD 파일");
    if (!startDate)             missing.push("시작 일");
    if (!endDate)               missing.push("종료 일");
    if (certification === null) missing.push("인증 여부");
    if (missing.length > 0) { setToastMessages(missing); return; }

    setSubmitStatus("submitting");
    setErrorMsg("");

    try {
      await createContest({
        title: title.trim(),
        targetAudience: targetAudience.trim(),
        description: description.trim(),
        certification: certification!,
        timeLimitSec,
        memoryLimitMb,
        exampleCode: exampleCode!,
        judgeCode: judgeCode!,
        visualizationHtml: visualizationHtml!,
        soloPlayHtml: soloPlayHtml ?? undefined,
        problemMd: problemMd!,
        startDate,
        endDate,
        maxParticipants,
      });
      setSubmitStatus("idle");
      setShowSuccessModal(true);
    } catch (err: unknown) {
      setSubmitStatus("error");
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.message ?? err.response?.statusText;
        setErrorMsg(msg ? `[${err.response?.status}] ${msg}` : "서버에 연결할 수 없습니다.");
      } else if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("알 수 없는 오류가 발생했습니다.");
      }
    }
  };

  return (
    <div className="cc-page">
      {toastMessages.length > 0 && (
        <Toast messages={toastMessages} onClose={() => setToastMessages([])} />
      )}

      {showSuccessModal && (
        <div className="cc-modal-overlay">
          <div className="cc-modal">
            <div className="cc-modal-icon">✓</div>
            <p className="cc-modal-msg">대회가 성공적으로 등록되었습니다.</p>
            <button
              className="cc-modal-confirm"
              onClick={() => { setShowSuccessModal(false); navigate("battle"); }}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="home-header">
        <span className="home-logo" onClick={() => navigate("battle")}>ASAP 캡스톤</span>
        <div className="cc-header-spacer" />
        <div className="home-auth-area">
          <button
            className="home-auth-btn home-auth-btn--ghost"
            onClick={() => navigate("home")}
          >
            📝 알고리즘 문제
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
        <div className="cc-content">
          <button className="cc-back-link" onClick={() => navigate("battle")}>
            ← 대회 목록
          </button>
          <h2 className="cc-page-title">대회 개최</h2>

          <div className="cc-form">
            {/* 기본 정보 */}
            <section className="cc-section">
              <h3 className="cc-section-title">기본 정보</h3>
              <div className="cc-field">
                <label className="cc-label">
                  대회 이름 <Req show={!title.trim()} />
                </label>
                <input
                  className="cc-input"
                  type="text"
                  placeholder="대회 이름을 입력하세요"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="cc-field">
                <label className="cc-label">
                  참가 대상 <Req show={!targetAudience.trim()} />
                </label>
                <input
                  className="cc-input"
                  type="text"
                  placeholder="예: 전체 참가 가능, 컴퓨터공학과 3학년 이상"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                />
              </div>
            </section>

            {/* 문제 설명 */}
            <section className="cc-section">
              <h3 className="cc-section-title">문제 설명</h3>
              <div className="cc-field">
                <label className="cc-label">
                  문제 설명 <Req show={!description.trim()} />
                </label>
                <MdEditor
                  value={description}
                  onChange={setDescription}
                  rows={8}
                  placeholder="문제를 설명해주세요. Markdown을 지원합니다."
                />
              </div>
            </section>

            {/* 제한 */}
            <section className="cc-section">
              <h3 className="cc-section-title">제한</h3>
              <div className="cc-row">
                <div className="cc-field">
                  <label className="cc-label">
                    시간 제한 (초/턴) <span className="cc-required">*</span>
                  </label>
                  <input
                    className="cc-input"
                    type="number"
                    min={1}
                    max={60}
                    value={timeLimitSec}
                    onChange={(e) => setTimeLimitSec(Number(e.target.value))}
                  />
                </div>
                <div className="cc-field">
                  <label className="cc-label">
                    메모리 제한 (MB) <span className="cc-required">*</span>
                  </label>
                  <input
                    className="cc-input"
                    type="number"
                    min={16}
                    max={2048}
                    value={memoryLimitMb}
                    onChange={(e) => setMemoryLimitMb(Number(e.target.value))}
                  />
                </div>
              </div>
            </section>

            {/* 파일 첨부 */}
            <section className="cc-section">
              <h3 className="cc-section-title">파일 첨부</h3>
              <FileInput
                label="샘플 코드"
                required
                accept=".py,.cpp,.java,.js,.ts"
                value={exampleCode}
                onChange={setExampleCode}
              />
              <FileInput
                label="채점 코드"
                required
                accept=".py,.cpp,.java,.js,.ts"
                value={judgeCode}
                onChange={setJudgeCode}
              />
              <FileInput
                label="시각화 HTML 파일"
                required
                accept=".html"
                value={visualizationHtml}
                onChange={setVisualizationHtml}
              />
              <FileInput
                label="혼자서 플레이 HTML 파일"
                accept=".html"
                value={soloPlayHtml}
                onChange={setSoloPlayHtml}
              />
              <FileInput
                label="문제 명세 MD 파일"
                required
                accept=".md,.txt"
                value={problemMd}
                onChange={setProblemMd}
              />
            </section>

            {/* 대회 설정 */}
            <section className="cc-section">
              <h3 className="cc-section-title">대회 설정</h3>
              <div className="cc-row">
                <div className="cc-field">
                  <label className="cc-label">
                    시작 일 <Req show={!startDate} />
                  </label>
                  <input
                    className="cc-input cc-input--date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="cc-field">
                  <label className="cc-label">
                    종료 일 <Req show={!endDate} />
                  </label>
                  <input
                    className="cc-input cc-input--date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="cc-field cc-field--narrow">
                <label className="cc-label">
                  최대 참가자 수 <span className="cc-required">*</span>
                </label>
                <input
                  className="cc-input"
                  type="number"
                  min={1}
                  max={10000}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(Number(e.target.value))}
                />
              </div>
            </section>

            {/* 인증 여부 */}
            <section className="cc-section">
              <h3 className="cc-section-title">
                인증 여부 <Req show={certification === null} />
              </h3>
              <div className="cc-cert-group">
                <button
                  type="button"
                  className={`cc-cert-btn${certification === true ? " cc-cert-btn--certified" : ""}`}
                  onClick={() => setCertification(true)}
                >
                  인증
                </button>
                <button
                  type="button"
                  className={`cc-cert-btn${certification === false ? " cc-cert-btn--uncertified" : ""}`}
                  onClick={() => setCertification(false)}
                >
                  비인증
                </button>
              </div>
            </section>

            {/* Submit area */}
            <div className="cc-submit-area">
              {certification === true && (
                <button
                  type="button"
                  className="cc-next-btn"
                  onClick={() => { /* TODO: 인증 대회 다음 단계 */ }}
                >
                  다음 단계로
                </button>
              )}
              <button
                type="button"
                className="cc-submit-btn"
                onClick={handleSubmit}
                disabled={submitStatus === "submitting"}
              >
                {submitStatus === "submitting" ? "등록 중..." : "대회 생성"}
              </button>
              <button
                type="button"
                className="cc-cancel-btn"
                onClick={() => navigate("battle")}
              >
                취소
              </button>
              {submitStatus === "error" && <span className="cc-error-msg">{errorMsg}</span>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BattleCreateContestPage;
