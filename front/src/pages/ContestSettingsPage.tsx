import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { marked } from "marked";
import mammoth from "mammoth";
import { useApp } from "../context/AppContext";
import BattleTopNav from "../components/BattleTopNav";
import { getContestDetail } from "../api/codeBattleApi";
import { modifyContest, modifyCertifiedContest } from "../api/contestApi";
import Breadcrumb from "../components/Breadcrumb";
import RichTextEditor from "../components/RichTextEditor";
import "./AppLayout.css";
import "./BattleCreateContestPage.css";

const Req: React.FC<{ show: boolean }> = ({ show }) =>
  show ? <span className="cc-required">*</span> : null;

interface ToastProps { messages: string[]; onClose: () => void; }
const Toast: React.FC<ToastProps> = ({ messages, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="cc-toast">
      <span className="cc-toast-icon">⚠</span>
      <div className="cc-toast-body">
        <strong>필수 항목을 입력해주세요</strong>
        <ul className="cc-toast-list">{messages.map((m) => <li key={m}>{m}</li>)}</ul>
      </div>
      <button className="cc-toast-close" onClick={onClose}>✕</button>
    </div>
  );
};

const isDescEmpty = (html: string) =>
  !html || html === "<p></p>" || html.replace(/<[^>]*>/g, "").trim() === "";

interface FileInputProps {
  label: string;
  required?: boolean;
  accept?: string;
  value: File | null;
  onChange: (f: File | null) => void;
  hint?: string;
}
const FileInput: React.FC<FileInputProps> = ({ label, required, accept, value, onChange, hint }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="cc-field">
      <label className="cc-label">
        {label}
        {required && <Req show={!value} />}
        {hint && <span className="cc-optional-hint">{hint}</span>}
      </label>
      <div className="cc-file-row">
        <button type="button" className="cc-file-btn" onClick={() => inputRef.current?.click()}>파일 선택</button>
        <span className={`cc-file-name${!value ? " cc-file-name--empty" : ""}`}>
          {value ? value.name : "선택된 파일 없음"}
        </span>
        {value && (
          <button type="button" className="cc-file-clear" onClick={() => { onChange(null); if (inputRef.current) inputRef.current.value = ""; }}>✕</button>
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} style={{ display: "none" }} onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
    </div>
  );
};

function getContestIdFromHash(): number | null {
  const parts = window.location.hash.replace("#", "").split("/");
  if (parts.length >= 2) {
    const id = parseInt(parts[1], 10);
    return isNaN(id) ? null : id;
  }
  return null;
}

const ContestSettingsPage: React.FC = () => {
  const { navigate } = useApp();
  const contestId = getContestIdFromHash();

  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState<string | null>(null);

  const [title, setTitle]                         = useState("");
  const [description, setDescription]             = useState("");
  const [timeLimitSec, setTimeLimitSec]           = useState<number>(10);
  const [memoryLimitMb, setMemoryLimitMb]         = useState<number>(256);
  const [sampleCode, setSampleCode]               = useState<File | null>(null);
  const [judgeCode, setJudgeCode]                 = useState<File | null>(null);
  const [exampleAiCodes, setExampleAiCodes]       = useState<File[]>([]);
  const [visualizationHtml, setVisualizationHtml] = useState<File | null>(null);
  const [soloPlayHtml, setSoloPlayHtml]           = useState<File | null>(null);
  const [startDate, setStartDate]                 = useState("");
  const [endDate, setEndDate]                     = useState("");
  const [maxParticipants, setMaxParticipants]     = useState<number>(100);
  const [certification, setCertification]         = useState<boolean>(false);

  const [hasSampleCode, setHasSampleCode]     = useState(false);
  const [hasVisHtml, setHasVisHtml]           = useState(false);
  const [hasSoloHtml, setHasSoloHtml]         = useState(false);
  const [existingAiCount, setExistingAiCount] = useState(0);

  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMsg, setErrorMsg]         = useState("");
  const [toastMessages, setToastMessages] = useState<string[]>([]);
  const [modifySuccess, setModifySuccess] = useState(false);

  const [aiCodeInputKey, setAiCodeInputKey] = useState(0);
  const [importing, setImporting]           = useState(false);
  const docImportRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!contestId) { setLoadError("잘못된 대회 ID입니다."); setLoading(false); return; }
    getContestDetail(contestId)
      .then(detail => {
        setTitle(detail.title);
        setDescription(detail.description ?? "");
        setTimeLimitSec(detail.timeLimitSec);
        setMemoryLimitMb(detail.memoryLimitMb);
        setCertification(detail.certification);
        setMaxParticipants(detail.maxParticipants);
        if (detail.startDate) setStartDate(detail.startDate.replace(" ", "T").slice(0, 16));
        if (detail.endDate)   setEndDate(detail.endDate.replace(" ", "T").slice(0, 16));
        setHasSampleCode((detail.sampleCodes?.length ?? 0) > 0);
        setHasVisHtml(!!detail.visualizationHtml);
        setHasSoloHtml(!!detail.soloPlayHtml);
        setExistingAiCount(detail.exampleAiCodes?.length ?? 0);
      })
      .catch(() => setLoadError("대회 정보를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [contestId]);

  const handleDocImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let html = "";
      if (ext === "html" || ext === "htm") {
        html = await file.text();
      } else if (ext === "md") {
        html = await Promise.resolve(marked.parse(await file.text()));
      } else if (ext === "txt") {
        const text = await file.text();
        html = text.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
      } else if (ext === "docx") {
        const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
        html = result.value;
      }
      if (html) setDescription(html);
    } finally {
      setImporting(false);
    }
  };

  const handleAiCodeAdd = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setExampleAiCodes(prev => [...prev, ...Array.from(files)]);
    setAiCodeInputKey(k => k + 1);
  };
  const handleAiCodeRemove = (i: number) =>
    setExampleAiCodes(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    const missing: string[] = [];
    if (!title.trim())            missing.push("대회 이름");
    if (isDescEmpty(description)) missing.push("문제 설명");
    if (!startDate)               missing.push("시작 일시");
    if (!endDate)                 missing.push("종료 일시");
    if (missing.length > 0)       { setToastMessages(missing); return; }

    setSubmitStatus("submitting");
    setErrorMsg("");
    try {
      const data = {
        title: title.trim(),
        description: description.trim(),
        timeLimitSec,
        memoryLimitMb,
        sampleCode,
        judgeCode,
        exampleAiCodes,
        visualizationHtml,
        soloPlayHtml,
        startDate,
        endDate,
        maxParticipants,
      };
      if (certification) {
        await modifyCertifiedContest(contestId!, data);
      } else {
        await modifyContest(contestId!, data);
      }
      setSubmitStatus("idle");
      setModifySuccess(true);
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

  if (loading) {
    return (
      <div className="cc-page">
        <header className="home-header">
          <span className="home-logo" onClick={() => navigate("landing")}>
            <img src="/resources/logo/TacticalCodeBattle_logo.png" alt="TCB" className="home-logo-img" />
          </span>
        </header>
        <main className="home-body">
          <div className="cc-content">
            <p style={{ padding: "48px", color: "#6b7280" }}>대회 정보를 불러오는 중...</p>
          </div>
        </main>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="cc-page">
        <header className="home-header">
          <span className="home-logo" onClick={() => navigate("landing")}>
            <img src="/resources/logo/TacticalCodeBattle_logo.png" alt="TCB" className="home-logo-img" />
          </span>
        </header>
        <main className="home-body">
          <div className="cc-content" style={{ padding: "48px" }}>
            <p style={{ color: "#dc2626", marginBottom: "16px" }}>{loadError}</p>
            <Breadcrumb items={[
              { label: "대회 목록", onClick: () => navigate("battle") },
              { label: "대회 설정" },
            ]} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="cc-page">
      {toastMessages.length > 0 && <Toast messages={toastMessages} onClose={() => setToastMessages([])} />}

      {modifySuccess && (
        <div className="cc-modal-overlay">
          <div className="cc-modal">
            <div className="cc-modal-icon">✓</div>
            <p className="cc-modal-msg">대회가 성공적으로 수정되었습니다.</p>
            <button className="cc-modal-confirm" onClick={() => { setModifySuccess(false); navigate("battle"); }}>확인</button>
          </div>
        </div>
      )}

      <BattleTopNav spacer />

      <main className="home-body">
        <div className="cc-content">
          <div className="cc-layout">
            <div className="cc-form-col">
              <Breadcrumb items={[
              { label: "대회 목록", onClick: () => navigate("battle") },
              { label: "대회 설정" },
            ]} />
              <h2 className="cc-page-title">대회 설정</h2>

              <div className="cc-form">
                {/* 기본 정보 */}
                <section className="cc-section">
                  <h3 className="cc-section-title">기본 정보</h3>
                  <div className="cc-title-row">
                    <div className="cc-field cc-field--grow">
                      <label className="cc-label">대회 이름 <Req show={!title.trim()} /></label>
                      <input
                        className="cc-input"
                        type="text"
                        placeholder="대회 이름을 입력하세요"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                    </div>
                    <div className="cc-field cc-field--cert-inline">
                      <label className="cc-label">인증 여부</label>
                      <div className="cc-cert-group">
                        <button
                          type="button"
                          className={`cc-cert-btn${!certification ? " cc-cert-btn--uncertified" : ""}`}
                          disabled
                        >
                          비인증
                        </button>
                        <button
                          type="button"
                          className={`cc-cert-btn${certification ? " cc-cert-btn--certified" : ""}`}
                          disabled
                        >
                          인증
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 문제 설명 */}
                <section className="cc-section">
                  <h3 className="cc-section-title">문제 설명</h3>
                  <div className="cc-field">
                    <div className="cc-label-row">
                      <label className="cc-label">문제 설명 <Req show={isDescEmpty(description)} /></label>
                      <button type="button" className="cc-import-btn" disabled={importing} onClick={() => docImportRef.current?.click()}>
                        {importing ? "불러오는 중…" : "문서 불러오기"}
                      </button>
                      <input ref={docImportRef} type="file" accept=".md,.txt,.html,.htm,.docx" style={{ display: "none" }} onChange={handleDocImport} />
                    </div>
                    <RichTextEditor
                      value={description}
                      onChange={setDescription}
                      placeholder="문제를 설명해주세요."
                      minHeight={280}
                    />
                  </div>
                </section>

                {/* 제한 */}
                <section className="cc-section">
                  <h3 className="cc-section-title">제한</h3>
                  <div className="cc-row">
                    <div className="cc-field">
                      <label className="cc-label">시간 제한 (초/턴) <span className="cc-required">*</span></label>
                      <input className="cc-input" type="number" min={10} max={60} value={timeLimitSec} onChange={(e) => setTimeLimitSec(Number(e.target.value))} />
                    </div>
                    <div className="cc-field">
                      <label className="cc-label">메모리 제한 (MB) <span className="cc-required">*</span></label>
                      <input className="cc-input" type="number" min={128} max={512} value={memoryLimitMb} onChange={(e) => setMemoryLimitMb(Number(e.target.value))} />
                    </div>
                  </div>
                </section>

                {/* 파일 첨부 */}
                <section className="cc-section">
                  <h3 className="cc-section-title">파일 첨부</h3>
                  <FileInput
                    label="샘플 코드"
                    accept=".py,.cpp,.java,.js,.ts"
                    value={sampleCode}
                    onChange={setSampleCode}
                    hint={hasSampleCode ? " (현재 파일 있음 — 변경 시 업로드)" : undefined}
                  />
                  <FileInput
                    label="채점 코드"
                    accept=".py,.cpp,.java,.js,.ts"
                    value={judgeCode}
                    onChange={setJudgeCode}
                    hint=" (변경 시 업로드)"
                  />

                  {/* 예시 AI 코드 */}
                  <div className="cc-field">
                    <label className="cc-label">예시 AI 코드</label>
                    {exampleAiCodes.length === 0 && existingAiCount > 0 && (
                      <p className="cc-field-hint">현재 {existingAiCount}개 코드 있음 — 새 파일 추가 시 교체됩니다.</p>
                    )}
                    {exampleAiCodes.length === 0 && existingAiCount === 0 && (
                      <p className="cc-field-hint">참가자의 코드가 대결할 예시 AI 코드를 추가하세요.</p>
                    )}
                    {exampleAiCodes.length > 0 && (
                      <div className="cc-ai-code-list">
                        {exampleAiCodes.map((f, i) => (
                          <div key={i} className="cc-ai-code-row">
                            <span className="cc-ai-code-name">{f.name}</span>
                            <button type="button" className="cc-reviewer-remove" onClick={() => handleAiCodeRemove(i)} aria-label="삭제">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label htmlFor="cs-ai-code-input" className="cc-reviewer-add">+ AI 코드 추가</label>
                    <input
                      key={aiCodeInputKey}
                      id="cs-ai-code-input"
                      type="file"
                      accept=".py,.cpp,.java,.js,.ts"
                      multiple
                      style={{ display: "none" }}
                      onChange={(e) => handleAiCodeAdd(e.target.files)}
                    />
                  </div>

                  <FileInput
                    label="시각화 HTML 파일"
                    accept=".html"
                    value={visualizationHtml}
                    onChange={setVisualizationHtml}
                    required={certification && !hasVisHtml}
                    hint={hasVisHtml ? " (현재 파일 있음 — 변경 시 업로드)" : (!certification ? " (선택)" : undefined)}
                  />
                  <FileInput
                    label="혼자서 플레이 HTML 파일"
                    accept=".html"
                    value={soloPlayHtml}
                    onChange={setSoloPlayHtml}
                    required={certification && !hasSoloHtml}
                    hint={hasSoloHtml ? " (현재 파일 있음 — 변경 시 업로드)" : (!certification ? " (선택)" : undefined)}
                  />
                </section>

                {/* 대회 설정 */}
                <section className="cc-section">
                  <h3 className="cc-section-title">대회 설정</h3>
                  <div className="cc-row">
                    <div className="cc-field">
                      <label className="cc-label">시작 일시 <Req show={!startDate} /></label>
                      <input className="cc-input cc-input--date" type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="cc-field">
                      <label className="cc-label">종료 일시 <Req show={!endDate} /></label>
                      <input className="cc-input cc-input--date" type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                  </div>
                  <div className="cc-field cc-field--narrow">
                    <label className="cc-label">최대 참가자 수 <span className="cc-required">*</span></label>
                    <input className="cc-input" type="number" min={1} max={10000} value={maxParticipants} onChange={(e) => setMaxParticipants(Number(e.target.value))} />
                  </div>
                </section>

                {/* 버튼 영역 */}
                <div className="cc-submit-area">
                  <button
                    type="button"
                    className="cc-submit-btn"
                    onClick={handleSubmit}
                    disabled={submitStatus === "submitting"}
                  >
                    {submitStatus === "submitting" ? "수정 중..." : "수정"}
                  </button>
                  <button type="button" className="cc-cancel-btn" onClick={() => navigate("battle")}>취소</button>
                  {submitStatus === "error" && <span className="cc-error-msg">{errorMsg}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ContestSettingsPage;
