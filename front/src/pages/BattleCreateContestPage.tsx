import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useApp } from "../context/AppContext";
import { createContest, ContestResponse, ContestStatus } from "../api/contestApi";
import { setContestDraft } from "../contestDraft";
import ContestSidebar from "../components/ContestSidebar";
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


interface MdEditorProps { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; }
const MdEditor: React.FC<MdEditorProps> = ({ value, onChange, rows = 6, placeholder }) => {
  const [tab, setTab] = useState<"write" | "preview">("write");
  return (
    <div className="cc-md-editor">
      <div className="cc-md-tabs">
        <button type="button" className={`cc-md-tab${tab === "write" ? " cc-md-tab--active" : ""}`} onClick={() => setTab("write")}>편집</button>
        <button type="button" className={`cc-md-tab${tab === "preview" ? " cc-md-tab--active" : ""}`} onClick={() => setTab("preview")}>미리보기</button>
      </div>
      {tab === "write" ? (
        <textarea className="cc-md-textarea" rows={rows} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : value.trim() ? (
        <div className="cc-md-preview"><ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown></div>
      ) : (
        <div className="cc-md-empty">미리볼 내용이 없습니다.</div>
      )}
    </div>
  );
};

interface FileInputProps { label: string; required?: boolean; accept?: string; value: File | null; onChange: (f: File | null) => void; hint?: string; }
const FileInput: React.FC<FileInputProps> = ({ label, required, accept, value, onChange, hint }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="cc-field">
      <label className="cc-label">{label}{required && <Req show={!value} />}{hint && <span className="cc-optional-hint">{hint}</span>}</label>
      <div className="cc-file-row">
        <button type="button" className="cc-file-btn" onClick={() => inputRef.current?.click()}>파일 선택</button>
        <span className={`cc-file-name${!value ? " cc-file-name--empty" : ""}`}>{value ? value.name : "선택된 파일 없음"}</span>
        {value && (
          <button type="button" className="cc-file-clear" onClick={() => { onChange(null); if (inputRef.current) inputRef.current.value = ""; }}>✕</button>
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} style={{ display: "none" }} onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
    </div>
  );
};

const BattleCreateContestPage: React.FC = () => {
  const { user, logout, navigate } = useApp();

  const [title, setTitle]                   = useState("");
  const [description, setDescription]       = useState("");
  const [timeLimitSec, setTimeLimitSec]     = useState<number>(1);
  const [memoryLimitMb, setMemoryLimitMb]   = useState<number>(256);
  const [sampleCode, setSampleCode]         = useState<File | null>(null);
  const [judgeCode, setJudgeCode]           = useState<File | null>(null);
  const [exampleAiCodes, setExampleAICodes] = useState<File[]>([]);
  const [visualizationHtml, setVisualizationHtml] = useState<File | null>(null);
  const [soloPlayHtml, setSoloPlayHtml]     = useState<File | null>(null);
  const [startDate, setStartDate]           = useState("");
  const [endDate, setEndDate]               = useState("");
  const [maxParticipants, setMaxParticipants] = useState<number>(100);
  const [certification, setCertification]   = useState<boolean>(false);
  const [status, setStatus]                 = useState<ContestStatus>("PLANNED");

  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMsg, setErrorMsg]         = useState("");
  const [toastMessages, setToastMessages] = useState<string[]>([]);
  const [createdContest, setCreatedContest] = useState<ContestResponse | null>(null);
  const [showPreview, setShowPreview]   = useState(false);

  const [aiCodeInputKey, setAiCodeInputKey] = useState(0);
  const descImportRef = useRef<HTMLInputElement>(null);

  const handleAICodeAdd = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setExampleAICodes(prev => [...prev, ...Array.from(files)]);
    setAiCodeInputKey(k => k + 1);
  };
  const handleAICodeRemove = (i: number) =>
    setExampleAICodes(prev => prev.filter((_, idx) => idx !== i));

  // 비인증 제출
  const handleSubmit = async () => {
    const missing: string[] = [];
    if (!title.trim())           missing.push("대회 이름");
    if (!description.trim()) missing.push("문제 설명");
    if (!sampleCode)             missing.push("샘플 코드");
    if (!judgeCode)              missing.push("채점 코드");
    if (exampleAiCodes.length === 0) missing.push("예시 AI 코드");
    if (!startDate)              missing.push("시작 일시");
    if (!endDate)                missing.push("종료 일시");
    if (missing.length > 0)      { setToastMessages(missing); return; }

    setSubmitStatus("submitting");
    setErrorMsg("");
    try {
      const result = await createContest({
        title: title.trim(), description: description.trim(),
        certification, timeLimitSec, memoryLimitMb,
        sampleCode: sampleCode!, judgeCode: judgeCode!,
        exampleAiCodes, visualizationHtml, soloPlayHtml,
        status, startDate, endDate, maxParticipants,
        creatorId: Number(user?.id ?? 0),
      });
      setSubmitStatus("idle");
      setCreatedContest(result);
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

  // 인증 — 다음 단계
  const handleNextStep = () => {
    const missing: string[] = [];
    if (!title.trim())           missing.push("대회 이름");
    if (!description.trim()) missing.push("문제 설명");
    if (!sampleCode)             missing.push("샘플 코드");
    if (!judgeCode)              missing.push("채점 코드");
    if (exampleAiCodes.length === 0) missing.push("예시 AI 코드");
    if (!visualizationHtml)      missing.push("시각화 HTML 파일");
    if (!soloPlayHtml)           missing.push("혼자서 하기 HTML 파일");
    if (!startDate)              missing.push("시작 일시");
    if (!endDate)                missing.push("종료 일시");
    if (missing.length > 0)      { setToastMessages(missing); return; }

    setContestDraft({
      title: title.trim(), description: description.trim(),
      certification: true, timeLimitSec, memoryLimitMb,
      sampleCode: sampleCode!, judgeCode: judgeCode!,
      exampleAiCodes, visualizationHtml, soloPlayHtml,
      status, startDate, endDate, maxParticipants,
      creatorId: Number(user?.id ?? 0),
    });
    navigate("create-certified-contest");
  };

  // 체크리스트 계산
  const checklist = [
    { label: "대회 이름",               done: !!title.trim(),             optional: false },
    { label: "문제 설명",               done: !!description.trim(),  optional: false },
    { label: "채점 코드",               done: !!judgeCode,                optional: false },
    { label: "샘플 코드",               done: !!sampleCode,               optional: false },
    { label: "예시 AI 코드 (1개 이상)", done: exampleAiCodes.length > 0,  optional: false },
    { label: "시각화 HTML",             done: !!visualizationHtml,        optional: !certification },
    { label: "혼자서 하기 HTML",        done: !!soloPlayHtml,             optional: !certification },
    { label: "시작 일시",               done: !!startDate,                optional: false },
    { label: "종료 일시",               done: !!endDate,                  optional: false },
  ] as { label: string; done: boolean; optional: boolean }[];

  const allDone = checklist.filter(c => !c.optional).every(c => c.done);

  return (
    <div className="cc-page">
      {toastMessages.length > 0 && <Toast messages={toastMessages} onClose={() => setToastMessages([])} />}

      {createdContest !== null && (
        <div className="cc-modal-overlay">
          <div className="cc-modal">
            <div className="cc-modal-icon">✓</div>
            <p className="cc-modal-msg">대회가 성공적으로 등록되었습니다.</p>
            <div className="cc-modal-info">
              <div className="cc-modal-info-row"><span className="cc-modal-info-label">ID</span><span className="cc-modal-info-value">{createdContest.id}</span></div>
              <div className="cc-modal-info-row"><span className="cc-modal-info-label">상태</span><span className="cc-modal-info-value">{createdContest.status}</span></div>
              <div className="cc-modal-info-row"><span className="cc-modal-info-label">생성 일시</span><span className="cc-modal-info-value">{new Date(createdContest.createdAt).toLocaleString("ko-KR")}</span></div>
            </div>
            <button className="cc-modal-confirm" onClick={() => { setCreatedContest(null); navigate("battle"); }}>확인</button>
          </div>
        </div>
      )}

      {showPreview && (
        <div className="cc-preview-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowPreview(false); }}>
          <div className="cc-preview-panel">
            <div className="cc-preview-header">
              <span className="cc-preview-header-title">미리보기</span>
              <button className="cc-preview-back-btn" onClick={() => setShowPreview(false)}>닫기</button>
            </div>
            <div className="cc-preview-body">
              <h1 className="cc-preview-title">{title || "(제목 없음)"}</h1>
              <div className="cc-preview-badges">
                <span className={`cc-preview-badge ${certification ? "cc-preview-badge--cert" : "cc-preview-badge--uncert"}`}>{certification ? "인증" : "비인증"}</span>
                <span className="cc-preview-badge cc-preview-badge--status">{status}</span>
              </div>
              <div className="cc-preview-meta">
                <div className="cc-preview-meta-item"><span className="cc-preview-meta-label">시작</span><span className="cc-preview-meta-value">{startDate || "—"}</span></div>
                <div className="cc-preview-meta-item"><span className="cc-preview-meta-label">종료</span><span className="cc-preview-meta-value">{endDate || "—"}</span></div>
                <div className="cc-preview-meta-item"><span className="cc-preview-meta-label">최대 참가자</span><span className="cc-preview-meta-value">{maxParticipants}명</span></div>
                <div className="cc-preview-meta-item"><span className="cc-preview-meta-label">시간 제한</span><span className="cc-preview-meta-value">{timeLimitSec}초/턴</span></div>
                <div className="cc-preview-meta-item"><span className="cc-preview-meta-label">메모리 제한</span><span className="cc-preview-meta-value">{memoryLimitMb} MB</span></div>
              </div>
              <div>
                <div className="cc-preview-desc-label">문제 설명</div>
                {description.trim()
                  ? <div className="cc-md-preview"><ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown></div>
                  : <div className="cc-md-empty">문제 설명이 없습니다.</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="home-header">
        <span className="home-logo" onClick={() => navigate("landing")}>
          <img src="/resources/logo/TacticalCodeBattle_logo.png" alt="TCB" className="home-logo-img" />
        </span>
        <div className="cc-header-spacer" />
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
              <button className="home-auth-btn home-auth-btn--primary" onClick={() => navigate("login")}>로그인</button>
            </>
          )}
        </div>
      </header>

      <main className="home-body">
        <div className="cc-content">
          <div className="cc-layout">

            {/* ── 폼 컬럼 ── */}
            <div className="cc-form-col">
              <button className="cc-back-link" onClick={() => navigate("battle")}>← 대회 목록</button>
              <h2 className="cc-page-title">대회 개최</h2>

              <div className="cc-form">
                {/* 기본 정보 — 이름 + 인증 토글 한 행 */}
                <section className="cc-section">
                  <h3 className="cc-section-title">기본 정보</h3>
                  <div className="cc-title-row">
                    <div className="cc-field cc-field--grow">
                      <label className="cc-label">대회 이름 <Req show={!title.trim()} /></label>
                      <input className="cc-input" type="text" placeholder="대회 이름을 입력하세요" value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>
                    <div className="cc-field cc-field--cert-inline">
                      <label className="cc-label">인증 여부</label>
                      <div className="cc-cert-group">
                        <button type="button" className={`cc-cert-btn${!certification ? " cc-cert-btn--uncertified" : ""}`} onClick={() => setCertification(false)}>비인증</button>
                        <button type="button" className={`cc-cert-btn${certification ? " cc-cert-btn--certified" : ""}`} onClick={() => setCertification(true)}>인증</button>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 문제 설명 */}
                <section className="cc-section">
                  <h3 className="cc-section-title">문제 설명</h3>
                  <div className="cc-field">
                    <div className="cc-label-row">
                      <label className="cc-label">문제 설명 <Req show={!description.trim()} /></label>
                      <button type="button" className="cc-import-btn" onClick={() => descImportRef.current?.click()}>
                        문서 불러오기
                      </button>
                      <input
                        ref={descImportRef}
                        type="file"
                        accept=".md,.txt"
                        style={{ display: "none" }}
                        onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setDescription(await f.text()); e.target.value = ""; }}
                      />
                    </div>
                    <MdEditor value={description} onChange={setDescription} rows={8} placeholder="문제를 설명해주세요. Markdown을 지원합니다." />
                  </div>
                </section>

                {/* 제한 */}
                <section className="cc-section">
                  <h3 className="cc-section-title">제한</h3>
                  <div className="cc-row">
                    <div className="cc-field">
                      <label className="cc-label">시간 제한 (초/턴) <span className="cc-required">*</span></label>
                      <input className="cc-input" type="number" min={1} max={60} value={timeLimitSec} onChange={(e) => setTimeLimitSec(Number(e.target.value))} />
                    </div>
                    <div className="cc-field">
                      <label className="cc-label">메모리 제한 (MB) <span className="cc-required">*</span></label>
                      <input className="cc-input" type="number" min={16} max={2048} value={memoryLimitMb} onChange={(e) => setMemoryLimitMb(Number(e.target.value))} />
                    </div>
                  </div>
                </section>

                {/* 파일 첨부 */}
                <section className="cc-section">
                  <h3 className="cc-section-title">파일 첨부</h3>
                  <FileInput label="샘플 코드" required accept=".py,.cpp,.java,.js,.ts" value={sampleCode} onChange={setSampleCode} />
                  <FileInput label="채점 코드" required accept=".py,.cpp,.java,.js,.ts" value={judgeCode} onChange={setJudgeCode} />

                  {/* 예시 AI 코드 (다중) */}
                  <div className="cc-field">
                    <label className="cc-label">예시 AI 코드 <Req show={exampleAiCodes.length === 0} /></label>
                    <p className="cc-field-hint">참가자의 코드가 대결할 예시 AI 코드를 추가하세요.</p>
                    {exampleAiCodes.length > 0 && (
                      <div className="cc-ai-code-list">
                        {exampleAiCodes.map((f, i) => (
                          <div key={i} className="cc-ai-code-row">
                            <span className="cc-ai-code-name">{f.name}</span>
                            <button type="button" className="cc-reviewer-remove" onClick={() => handleAICodeRemove(i)} aria-label="삭제">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label htmlFor="cc-ai-code-input" className="cc-reviewer-add">+ AI 코드 추가</label>
                    <input key={aiCodeInputKey} id="cc-ai-code-input" type="file" accept=".py,.cpp,.java,.js,.ts" multiple style={{ display: "none" }} onChange={(e) => handleAICodeAdd(e.target.files)} />
                  </div>

                  <FileInput label="시각화 HTML 파일" accept=".html" value={visualizationHtml} onChange={setVisualizationHtml} required={certification} hint={!certification ? " (선택)" : undefined} />
                  <FileInput label="혼자서 플레이 HTML 파일" accept=".html" value={soloPlayHtml} onChange={setSoloPlayHtml} required={certification} hint={!certification ? " (선택)" : undefined} />
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

                {/* 대회 상태 */}
                <section className="cc-section">
                  <h3 className="cc-section-title">대회 상태</h3>
                  <div className="cc-cert-group">
                    <button type="button" className={`cc-cert-btn${status === "TEST" ? " cc-cert-btn--certified" : ""}`} onClick={() => setStatus(status === "TEST" ? "PLANNED" : "TEST")}>TEST</button>
                  </div>
                </section>

                {/* 버튼 영역 */}
                <div className="cc-submit-area">
                  <button type="button" className="cc-preview-btn" onClick={() => setShowPreview(true)}>미리보기</button>
                  {certification ? (
                    <button type="button" className="cc-next-btn" onClick={handleNextStep}>다음 단계로 →</button>
                  ) : (
                    <button type="button" className="cc-submit-btn" onClick={handleSubmit} disabled={submitStatus === "submitting"}>
                      {submitStatus === "submitting" ? "등록 중..." : "대회 생성"}
                    </button>
                  )}
                  <button type="button" className="cc-cancel-btn" onClick={() => navigate("battle")}>취소</button>
                  {submitStatus === "error" && <span className="cc-error-msg">{errorMsg}</span>}
                </div>
              </div>
            </div>

            {/* ── 체크리스트 컬럼 ── */}
            <aside className="cc-checklist-col">
              <ContestSidebar
                currentStep={1}
                certification={certification}
                step1Items={checklist}
                step1AllDone={allDone}
              />
            </aside>

          </div>
        </div>
      </main>
    </div>
  );
};

export default BattleCreateContestPage;
