import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { marked } from "marked";
import mammoth from "mammoth";
import { useApp } from "../context/AppContext";
import Breadcrumb from "../components/Breadcrumb";
import { ContestStatus, AiCodeEntry, extToLanguage } from "../api/contestApi";
import { setContestDraft } from "../contestDraft";
import {
  PAYMENT_AMOUNT, buildDraft, saveDraft, requestTossPayment,
  loadDraft, clearDraft, deserializeFile,
} from "../api/paymentApi";
import { validateContestCode, subscribeToValidationResults, unsubscribeFromValidationResults, ValidationResult } from "../api/validationApi";
import ContestSidebar from "../components/ContestSidebar";
import RichTextEditor from "../components/RichTextEditor";
import AiAssistPanel from "../components/AiAssistPanel";
import ContestPreviewModal from "../components/ContestPreviewModal";
import ContestTutorial, { TutSnapshot, TutFileKind } from "../components/ContestTutorial";
import ValidationResultModal from "../components/ValidationResultModal";
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

function stepPow2(n: number, dir: 1 | -1, min = 128, max = 2048): number {
  const log = Math.log2(n);
  const newExp = dir === 1 ? Math.floor(log + 1e-9) + 1 : Math.ceil(log - 1e-9) - 1;
  return Math.max(min, Math.min(max, Math.pow(2, newExp)));
}

interface FileInputProps { label: string; required?: boolean; accept?: string; value: File | null; onChange: (f: File | null) => void; hint?: string; disabled?: boolean; }
const FileInput: React.FC<FileInputProps> = ({ label, required, accept, value, onChange, hint, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="cc-field">
      <label className="cc-label">{label}{required && <Req show={!value} />}{hint && <span className="cc-optional-hint">{hint}</span>}</label>
      <div className="cc-file-row">
        <button type="button" className="cc-file-btn" onClick={() => inputRef.current?.click()} disabled={disabled}>파일 선택</button>
        <span className={`cc-file-name${!value ? " cc-file-name--empty" : ""}`}>{value ? value.name : "선택된 파일 없음"}</span>
        {value && (
          <button type="button" className="cc-file-clear" onClick={() => { onChange(null); if (inputRef.current) inputRef.current.value = ""; }} disabled={disabled}>✕</button>
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} style={{ display: "none" }} onChange={(e) => onChange(e.target.files?.[0] ?? null)} disabled={disabled} />
    </div>
  );
};

const BattleCreateContestPage: React.FC<{ tutorial?: boolean }> = ({ tutorial = false }) => {
  const { user, logout, navigate, addCreatedContest } = useApp();

  const [title, setTitle]                   = useState("");
  const [description, setDescription]       = useState("");
  const [timeLimitSec, setTimeLimitSec]     = useState<number>(1);
  const [memoryLimitMb, setMemoryLimitMb]   = useState<number>(256);
  const [sampleCodes, setSampleCodes]       = useState<File[]>([]);
  const [judgeCode, setJudgeCode]           = useState<File | null>(null);
  const [exampleAiCodes, setExampleAiCodes] = useState<AiCodeEntry[]>([]);
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
  const [showPreview, setShowPreview]   = useState(false);

  // 결제 확인 모달
  const [showPayConfirm, setShowPayConfirm] = useState(false);
  const [payLoading,     setPayLoading]     = useState(false);

  // 검증 모달
  const [showValidation, setShowValidation] = useState(false);
  const [isValidating, setIsValidating]     = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // 검증 완료 상태 (필수 파일 3개 검증 완료)
  const [validationPassed, setValidationPassed] = useState(false);

  // 결제 실패 후 복구 토스트
  const [restoreToast, setRestoreToast] = useState(false);

  // 결제 실패 시 draft 복구
  useEffect(() => {
    const flag = sessionStorage.getItem("payment_fail_restore");
    if (!flag) return;
    sessionStorage.removeItem("payment_fail_restore");
    const draft = loadDraft();
    if (!draft) return;
    setTitle(draft.title);
    setDescription(draft.description);
    setCertification(draft.certification);
    setTimeLimitSec(draft.timeLimitSec);
    setMemoryLimitMb(draft.memoryLimitMb);
    setStatus(draft.status);
    setStartDate(draft.startDate);
    setEndDate(draft.endDate);
    setMaxParticipants(draft.maxParticipants);
    setSampleCodes(draft.sampleCodes.map(deserializeFile));
    setJudgeCode(deserializeFile(draft.judgeCode));
    setExampleAiCodes(draft.exampleAiCodes.map(e => ({
      file: deserializeFile(e.file),
      description: e.description,
    })));
    if (draft.visualizationHtml) setVisualizationHtml(deserializeFile(draft.visualizationHtml));
    if (draft.soloPlayHtml)      setSoloPlayHtml(deserializeFile(draft.soloPlayHtml));
    clearDraft();
    setRestoreToast(true);
    setTimeout(() => setRestoreToast(false), 4000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 튜토리얼 모드 ──────────────────────────────────────────────────────────
  const [tutPreviewOpened, setTutPreviewOpened] = useState(false);
  const [tutCreated, setTutCreated]             = useState(false);

  const applyTutorialFile = async (kind: TutFileKind) => {
    const map: Record<TutFileKind, string> = {
      desc:    "/tutorial/description.md",
      sample:  "/tutorial/sample_ai.cpp",
      judge:   "/tutorial/judge.cpp",
      example: "/tutorial/example_ai.cpp",
      logviz:  "/tutorial/log_visualization.html",
      solo:    "/tutorial/solo_play.html",
    };
    try {
      const res = await fetch(map[kind]);
      const text = await res.text();
      if (kind === "desc") {
        const html = await Promise.resolve(marked.parse(text));
        setDescription(html);
        return;
      }
      const blob = new Blob([text], { type: "text/plain" });
      const nameMap: Record<TutFileKind, string> = {
        desc: "", sample: "sample_ai.cpp", judge: "judge.cpp",
        example: "example_ai.cpp", logviz: "log_visualization.html", solo: "solo_play.html",
      };
      const file = new File([blob], nameMap[kind], { type: blob.type });
      if (kind === "sample")  setSampleCodes([file]);
      if (kind === "judge")   setJudgeCode(file);
      if (kind === "example") setExampleAiCodes([{ file, description: "사과게임 기본 예시 AI" }]);
      if (kind === "logviz")  setVisualizationHtml(file);
      if (kind === "solo")    setSoloPlayHtml(file);
    } catch (e) {
      console.error("[Tutorial] 파일 로드 실패:", kind, e);
    }
  };

  // 빠른 생성 (사과게임) — 개발 편의
  const [quickLoading, setQuickLoading] = useState(false);
  const handleQuickFill = async () => {
    setQuickLoading(true);
    try {
      const base = "/dev/apple";
      const fetchFile = async (name: string): Promise<File> => {
        const res = await fetch(`${base}/${name}`);
        const blob = await res.blob();
        return new File([blob], name, { type: blob.type || "text/plain" });
      };
      const [sampleFile, judgeFile, exampleFile, vizFile, soloFile] = await Promise.all([
        fetchFile("apple_sample_code.cpp"),
        fetchFile("apple_judge.cpp"),
        fetchFile("apple_example_code.cpp"),
        fetchFile("apple_game_log_visualization.html"),
        fetchFile("apple_game_soloPlay.html"),
      ]);
      setSampleCodes([sampleFile]);
      setJudgeCode(judgeFile);
      setExampleAiCodes([{ file: exampleFile, description: "사과게임 기본 예시 AI" }]);
      setVisualizationHtml(vizFile);
      setSoloPlayHtml(soloFile);
    } catch (e) {
      console.error("[QuickFill] 파일 로드 실패:", e);
    } finally {
      setQuickLoading(false);
    }
  };

  const [sampleCodeInputKey, setSampleCodeInputKey] = useState(0);
  const [aiCodeInputKey, setAiCodeInputKey] = useState(0);
  const [importing, setImporting] = useState(false);
  const docImportRef = useRef<HTMLInputElement>(null);

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

  const handleSampleCodeAdd = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSampleCodes(prev => [...prev, ...Array.from(files)]);
    setSampleCodeInputKey(k => k + 1);
  };
  const handleSampleCodeRemove = (i: number) =>
    setSampleCodes(prev => prev.filter((_, idx) => idx !== i));

  const handleAICodeAdd = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setExampleAiCodes(prev => [
      ...prev,
      ...Array.from(files).map(file => ({ file, description: "" })),
    ]);
    setAiCodeInputKey(k => k + 1);
  };
  const handleAICodeRemove = (i: number) =>
    setExampleAiCodes(prev => prev.filter((_, idx) => idx !== i));
  const handleAICodeDescChange = (i: number, desc: string) =>
    setExampleAiCodes(prev => prev.map((e, idx) => idx === i ? { ...e, description: desc } : e));

  // 필수 파일 3개 업로드 확인 (샘플 코드, 채점 코드, 예시 AI 코드)
  const areRequiredFilesUploaded = () =>
    sampleCodes.length > 0 && !!judgeCode && exampleAiCodes.length > 0;

  // 유효성 검사 (공통)
  const validate = (requireViz = false): string[] => {
    const missing: string[] = [];
    if (!title.trim())               missing.push("대회 이름");
    if (isDescEmpty(description))    missing.push("문제 설명");
    if (sampleCodes.length === 0)    missing.push("샘플 코드");
    if (!judgeCode)                  missing.push("채점 코드");
    if (exampleAiCodes.length === 0) missing.push("예시 AI 코드");
    if (!startDate)                  missing.push("시작 일시");
    if (!endDate)                    missing.push("종료 일시");
    if (requireViz && !visualizationHtml) missing.push("시각화 HTML 파일");
    if (requireViz && !soloPlayHtml)      missing.push("혼자서 하기 HTML 파일");
    return missing;
  };

  // 코드 검증 및 생성
  const handleValidateAndCreate = async () => {
    if (!judgeCode || sampleCodes.length === 0 || exampleAiCodes.length === 0 || !user?.id) {
      setErrorMsg("필수 파일을 모두 업로드해주세요.");
      return;
    }

    setIsValidating(true);
    setValidationResult(null);
    console.log("[handleValidateAndCreate] 검증 시작");

    try {
      // 파일 읽기
      const judgeCodeText = await judgeCode.text();
      const sampleCodesData = await Promise.all(
        sampleCodes.map(async file => ({
          code: await file.text(),
          language: extToLanguage(file.name) || "CPP",
        }))
      );
      const exampleAiCodesData = await Promise.all(
        exampleAiCodes.map(async entry => ({
          code: await entry.file.text(),
          language: extToLanguage(entry.file.name) || "CPP",
          description: entry.description,
        }))
      );

      // 검증 API 호출
      await validateContestCode({
        judgeCode: judgeCodeText,
        sampleCodes: sampleCodesData,
        exampleAiCodes: exampleAiCodesData,
      });

      // 검증 결과 콜백 등록
      subscribeToValidationResults(
        (result) => {
          console.log("[handleValidateAndCreate] 검증 결과 수신:", result);
          setValidationResult(result);
          setIsValidating(false);
          // 모든 항목이 통과되면 validationPassed 상태 업데이트
          if (result.passed) {
            setValidationPassed(true);
            console.log("[handleValidateAndCreate] 검증 완료 - 추가 항목 활성화");
          }
        },
        (error) => {
          console.error("[handleValidateAndCreate] 검증 오류:", error);
          setErrorMsg(error.message);
          setIsValidating(false);
        }
      );
    } catch (err: any) {
      console.error("[handleValidateAndCreate] 예외:", err);
      setErrorMsg(err?.message ?? "검증 요청 중 오류가 발생했습니다.");
      setIsValidating(false);
    }
  };

  // 검증 실패 시 재검증
  const handleRetryValidation = () => {
    setValidationResult(null);
    setValidationPassed(false);
    handleValidateAndCreate();
  };

  // 검증 성공 후 결제로 진행
  const handleProceedToPayment = () => {
    console.log("[handleProceedToPayment] 검증 성공, 결제 확인 모달 열기");
    setShowValidation(false);
    setShowPayConfirm(true);
  };

  // 비인증 — 검증 완료 후 결제 확인 모달 열기
  const handleSubmit = () => {
    if (!validationPassed) return;
    const missing = validate(false);
    if (missing.length > 0) { setToastMessages(missing); return; }
    setShowPayConfirm(true);
  };

  // 결제 진행 (임시저장 → Toss 결제 요청)
  const handlePayment = async (isCertified: boolean, reviewerEmails?: string[]) => {
    if (payLoading || !judgeCode) return;
    setPayLoading(true);
    try {
      const amount = isCertified ? PAYMENT_AMOUNT.certified : PAYMENT_AMOUNT.uncertified;
      console.log("[handlePayment] isCertified:", isCertified, "| amount:", amount);
      const orderId = "order-" + crypto.randomUUID();
      const draft = await buildDraft(orderId, amount, {
        certification: isCertified, creatorId: Number(user?.id ?? 0),
        title: title.trim(), description: description.trim(),
        timeLimitSec, memoryLimitMb, status, startDate, endDate, maxParticipants,
        sampleCodes, judgeCode, exampleAiCodes, visualizationHtml, soloPlayHtml,
        reviewerEmails,
      });
      saveDraft(draft);
      const orderName = isCertified ? "인증 대회 개최" : "비인증 대회 개최";
      await requestTossPayment(orderId, amount, orderName);
    } catch (err: any) {
      setPayLoading(false);
      setErrorMsg(err?.message ?? "결제 요청 중 오류가 발생했습니다.");
    }
  };

  // 인증 — 다음 단계
  const handleNextStep = () => {
    const missing = validate(true);
    if (missing.length > 0) { setToastMessages(missing); return; }
    setShowPayConfirm(true);
  };

  // 체크리스트 계산
  const checklist = [
    { label: "대회 이름",               done: !!title.trim(),             optional: false },
    { label: "문제 설명",               done: !isDescEmpty(description),  optional: false },
    { label: "채점 코드",               done: !!judgeCode,                optional: false },
    { label: "샘플 코드 (1개 이상)",     done: sampleCodes.length > 0,     optional: false },
    { label: "예시 AI 코드 (1개 이상)", done: exampleAiCodes.length > 0,  optional: false },
    { label: "시각화 HTML",             done: !!visualizationHtml,        optional: !certification },
    { label: "혼자서 하기 HTML",        done: !!soloPlayHtml,             optional: !certification },
    { label: "시작 일시",               done: !!startDate,                optional: false },
    { label: "종료 일시",               done: !!endDate,                  optional: false },
  ] as { label: string; done: boolean; optional: boolean }[];

  const allDone = checklist.filter(c => !c.optional).every(c => c.done);

  // 튜토리얼 상태 스냅샷
  const tutSnap: TutSnapshot = {
    title,
    certification,
    descFilled: !isDescEmpty(description),
    timeLimitSec,
    memoryLimitMb,
    sampleUploaded: sampleCodes.length > 0,
    judgeUploaded: !!judgeCode,
    exampleUploaded: exampleAiCodes.length > 0,
    vizUploaded: !!visualizationHtml,
    soloUploaded: !!soloPlayHtml,
    startDate,
    endDate,
    maxParticipants,
    previewOpened: tutPreviewOpened,
    created: tutCreated,
  };

  return (
    <div className={`cc-page${tutorial ? " cc-page--tutorial" : ""}`}>
      {toastMessages.length > 0 && <Toast messages={toastMessages} onClose={() => setToastMessages([])} />}
      {restoreToast && (
        <div className="cc-restore-toast">
          결제가 취소되었습니다. 입력하신 내용이 복구되었으니 다시 시도해주세요.
        </div>
      )}

      {/* 검증 결과 모달 */}
      <ValidationResultModal
        isOpen={showValidation}
        result={validationResult}
        isLoading={isValidating}
        onClose={() => {
          setShowValidation(false);
          unsubscribeFromValidationResults();
        }}
        onRetry={handleRetryValidation}
        onProceedToPayment={handleProceedToPayment}
      />

      {/* 결제 확인 모달 */}
      {showPayConfirm && (
        <div className="cc-modal-overlay" onClick={() => !payLoading && setShowPayConfirm(false)}>
          <div className="cc-modal cc-pay-modal" onClick={e => e.stopPropagation()}>
            <div className="cc-pay-modal-header">
              <span className="cc-pay-modal-title">결제 확인</span>
              <span className={`cc-pay-badge${certification ? " cc-pay-badge--cert" : ""}`}>
                {certification ? "인증 대회" : "비인증 대회"}
              </span>
            </div>

            <div className="cc-pay-summary">
              <div className="cc-pay-summary-row">
                <span>대회명</span>
                <span className="cc-pay-summary-val">{title.trim()}</span>
              </div>
              <div className="cc-pay-summary-row">
                <span>샘플 코드</span>
                <span className="cc-pay-summary-val">{sampleCodes.length}개</span>
              </div>
              <div className="cc-pay-summary-row">
                <span>예시 AI 코드</span>
                <span className="cc-pay-summary-val">{exampleAiCodes.length}개</span>
              </div>
              <div className="cc-pay-summary-row">
                <span>대회 기간</span>
                <span className="cc-pay-summary-val">
                  {startDate ? startDate.replace("T", " ") : "-"} ~ {endDate ? endDate.replace("T", " ") : "-"}
                </span>
              </div>
            </div>

            <div className="cc-pay-amount">
              <span>결제 금액</span>
              <span className="cc-pay-amount-value">
                {(certification ? PAYMENT_AMOUNT.certified : PAYMENT_AMOUNT.uncertified).toLocaleString()}원
              </span>
            </div>

            {errorMsg && <p className="cc-error-msg">{errorMsg}</p>}

            <div className="cc-pay-actions">
              <button
                className="cc-cancel-btn"
                onClick={() => { setShowPayConfirm(false); setErrorMsg(""); }}
                disabled={payLoading}
              >
                취소
              </button>
              <button
                className="cc-pay-btn"
                disabled={payLoading}
                onClick={() => {
                  if (certification) {
                    // 인증: 임시저장 후 검수자 설정 페이지로 (검수자 이메일 필요)
                    setContestDraft({
                      title: title.trim(), description: description.trim(),
                      certification: true, timeLimitSec, memoryLimitMb,
                      sampleCodes, judgeCode: judgeCode!,
                      exampleAiCodes, visualizationHtml, soloPlayHtml,
                      status, startDate, endDate, maxParticipants,
                      creatorId: Number(user?.id ?? 0),
                    });
                    setShowPayConfirm(false);
                    navigate("create-certified-contest");
                  } else {
                    handlePayment(false); // 비인증 — 클릭 시점의 certification 값을 명시적으로 전달
                  }
                }}
              >
                {payLoading ? "처리 중..." : certification ? "다음 단계 (검수자 설정) →" : "결제 진행"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreview && (
        <ContestPreviewModal
          title={title}
          description={description}
          timeLimitSec={timeLimitSec}
          memoryLimitMb={memoryLimitMb}
          maxParticipants={maxParticipants}
          certification={certification}
          status={status}
          startDate={startDate}
          endDate={endDate}
          visualizationHtml={visualizationHtml}
          soloPlayHtml={soloPlayHtml}
          onClose={() => setShowPreview(false)}
        />
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
              <button className="btn btn-secondary btn-sm" onClick={() => navigate("account-settings")}>설정</button>
              <button className="btn btn-ghost btn-sm" onClick={() => logout()}>로그아웃</button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate("signup")}>회원가입</button>
              <button className="btn btn-primary btn-sm" onClick={() => navigate("login")}>로그인</button>
            </>
          )}
        </div>
      </header>

      <main className="home-body">
        <div className="cc-content">
          <div className="cc-layout">

            {/* ── 폼 컬럼 ── */}
            <div className="cc-form-col">
              <Breadcrumb items={[
                { label: "대회 목록", onClick: () => navigate("battle") },
                { label: "대회 개최" },
              ]} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", maxWidth: 760 }}>
                <h2 className="cc-page-title" style={{ margin: 0 }}>대회 개최{tutorial && " (튜토리얼)"}</h2>
                {!tutorial && (
                  <button
                    type="button"
                    className="cc-quick-fill-btn"
                    onClick={handleQuickFill}
                    disabled={quickLoading}
                  >
                    {quickLoading ? "⏳ 로딩 중..." : "⚡ 빠른 생성 (사과게임)"}
                  </button>
                )}
              </div>

              <div className="cc-form">
                {/* 기본 정보 — 이름 + 인증 토글 한 행 */}
                <section className="cc-section">
                  <h3 className="cc-section-title">기본 정보</h3>
                  <div className="cc-title-row">
                    <div className="cc-field cc-field--grow" data-tut="title">
                      <label className="cc-label">대회 이름 <Req show={!title.trim()} /></label>
                      <input className="cc-input" type="text" placeholder="대회 이름을 입력하세요" value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>
                    <div className="cc-field cc-field--cert-inline" data-tut="cert">
                      <label className="cc-label">인증 여부</label>
                      <div className="cc-cert-group">
                        <button type="button" className={`cc-cert-btn${!certification ? " cc-cert-btn--uncertified" : ""}`} onClick={() => setCertification(false)}>비인증</button>
                        <button type="button" className={`cc-cert-btn${certification ? " cc-cert-btn--certified" : ""}`} onClick={() => setCertification(true)}>인증</button>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 문제 설명 */}
                <section className="cc-section" data-tut="desc">
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
                      placeholder="문제를 설명해주세요. 이미지, 링크, 표 등을 삽입할 수 있습니다."
                      minHeight={280}
                    />
                  </div>
                </section>

                {/* 제한 */}
                <section className="cc-section" data-tut="limit">
                  <h3 className="cc-section-title">제한</h3>
                  <div className="cc-row">
                    <div className="cc-field">
                      <label className="cc-label">시간 제한 (초/턴) <span className="cc-required">*</span></label>
                      <input className="cc-input" type="number" min={1} max={60} value={timeLimitSec} onChange={(e) => setTimeLimitSec(Number(e.target.value))} />
                    </div>
                    <div className="cc-field">
                      <label className="cc-label">메모리 제한 (MB) <span className="cc-required">*</span></label>
                      <div className="cc-pow2-wrap">
                        <input
                          className="cc-input cc-input--pow2"
                          type="number"
                          min={128}
                          max={2048}
                          value={memoryLimitMb}
                          onChange={(e) => setMemoryLimitMb(Number(e.target.value))}
                          onKeyDown={(e) => {
                            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                              e.preventDefault();
                              setMemoryLimitMb(prev => stepPow2(prev, e.key === "ArrowUp" ? 1 : -1));
                            }
                          }}
                        />
                        <div className="cc-pow2-btns">
                          <button type="button" className="cc-pow2-btn" tabIndex={-1}
                            onClick={() => setMemoryLimitMb(prev => stepPow2(prev, 1))}>▲</button>
                          <button type="button" className="cc-pow2-btn" tabIndex={-1}
                            onClick={() => setMemoryLimitMb(prev => stepPow2(prev, -1))}>▼</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 파일 첨부 */}
                <section className="cc-section">
                  <h3 className="cc-section-title">파일 첨부</h3>
                  {/* 샘플 코드 (다중) */}
                  <div className="cc-field" data-tut="sample">
                    <label className="cc-label">샘플 코드 <Req show={sampleCodes.length === 0} /></label>
                    <p className="cc-field-hint">참가자에게 제공할 예시 코드입니다. 여러 파일을 추가할 수 있습니다.</p>
                    {sampleCodes.length > 0 && (
                      <div className="cc-ai-code-list">
                        {sampleCodes.map((f, i) => (
                          <div key={i} className="cc-ai-code-row">
                            <span className="cc-lang-badge">{extToLanguage(f.name)}</span>
                            <span className="cc-ai-code-name">{f.name}</span>
                            <button type="button" className="cc-reviewer-remove" onClick={() => handleSampleCodeRemove(i)} aria-label="삭제">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label htmlFor="cc-sample-code-input" className="cc-reviewer-add">+ 샘플 코드 추가</label>
                    <input key={sampleCodeInputKey} id="cc-sample-code-input" type="file" accept=".py,.cpp,.java,.js,.ts,.c,.cs,.go,.rs,.kt,.lua" multiple style={{ display: "none" }} onChange={(e) => handleSampleCodeAdd(e.target.files)} />
                  </div>

                  <div data-tut="judge">
                    <FileInput label="채점 코드" required accept=".py,.cpp,.java,.js,.ts" value={judgeCode} onChange={setJudgeCode} />
                  </div>

                  {/* 예시 AI 코드 (다중 + 설명) */}
                  <div className="cc-field" data-tut="example">
                    <label className="cc-label">예시 AI 코드 <Req show={exampleAiCodes.length === 0} /></label>
                    <p className="cc-field-hint">참가자의 코드가 대결할 예시 AI 코드를 추가하세요.</p>
                    {exampleAiCodes.length > 0 && (
                      <div className="cc-ai-code-list">
                        {exampleAiCodes.map((entry, i) => (
                          <div key={i} className="cc-ai-code-item">
                            <div className="cc-ai-code-row">
                              <span className="cc-lang-badge">{extToLanguage(entry.file.name)}</span>
                              <span className="cc-ai-code-name">{entry.file.name}</span>
                              <button type="button" className="cc-reviewer-remove" onClick={() => handleAICodeRemove(i)} aria-label="삭제">✕</button>
                            </div>
                            <input
                              type="text"
                              className="cc-input cc-ai-code-desc"
                              placeholder="설명 입력 (선택)"
                              value={entry.description}
                              onChange={e => handleAICodeDescChange(i, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    <label htmlFor="cc-ai-code-input" className="cc-reviewer-add">+ AI 코드 추가</label>
                    <input key={aiCodeInputKey} id="cc-ai-code-input" type="file" accept=".py,.cpp,.java,.js,.ts,.c,.cs,.go,.rs,.kt,.lua" multiple style={{ display: "none" }} onChange={(e) => handleAICodeAdd(e.target.files)} />
                  </div>

                  {/* 검증 후 계속 버튼 - 필수 파일 3개 모두 업로드 후 표시 */}
                  {areRequiredFilesUploaded() && !validationPassed && (
                    <div className="cc-validate-btn-wrapper">
                      <button
                        type="button"
                        className="cc-validate-btn"
                        onClick={handleValidateAndCreate}
                        disabled={isValidating}
                      >
                        {isValidating ? "검증 중..." : "검증 후 계속"}
                      </button>
                    </div>
                  )}

                  <div data-tut="viz" className={!validationPassed ? "cc-section--disabled" : ""}>
                    <FileInput label="시각화 HTML 파일" accept=".html" value={visualizationHtml} onChange={setVisualizationHtml} required={certification} hint={!certification ? " (선택)" : undefined} disabled={!validationPassed} />
                    <FileInput label="혼자서 플레이 HTML 파일" accept=".html" value={soloPlayHtml} onChange={setSoloPlayHtml} required={certification} hint={!certification ? " (선택)" : undefined} disabled={!validationPassed} />
                  </div>
                </section>

                {/* 대회 설정 */}
                <section className={`cc-section${!validationPassed ? " cc-section--disabled" : ""}`}>
                  <h3 className="cc-section-title">대회 설정</h3>
                  <div className="cc-row" data-tut="date">
                    <div className="cc-field">
                      <label className="cc-label">시작 일시 <Req show={!startDate} /></label>
                      <input className="cc-input cc-input--date" type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={!validationPassed} />
                    </div>
                    <div className="cc-field">
                      <label className="cc-label">종료 일시 <Req show={!endDate} /></label>
                      <input className="cc-input cc-input--date" type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={!validationPassed} />
                    </div>
                  </div>
                  <div className="cc-field cc-field--narrow" data-tut="max">
                    <label className="cc-label">최대 참가자 수 <span className="cc-required">*</span></label>
                    <input className="cc-input" type="number" min={1} max={10000} value={maxParticipants} onChange={(e) => setMaxParticipants(Number(e.target.value))} disabled={!validationPassed} />
                  </div>
                </section>

                {/* 대회 상태 — 시연용 비활성화
                <section className="cc-section">
                  <h3 className="cc-section-title">대회 상태</h3>
                  <div className="cc-cert-group">
                    <button type="button" className={`cc-cert-btn${status === "TEST" ? " cc-cert-btn--certified" : ""}`} onClick={() => setStatus(status === "TEST" ? "PLANNED" : "TEST")}>TEST</button>
                  </div>
                </section>
                */}

                {/* 버튼 영역 */}
                <div className="cc-submit-area">
                  <span data-tut="preview" style={{ display: "inline-block" }}>
                    <button type="button" className="cc-preview-btn"
                      onClick={() => { setShowPreview(true); setTutPreviewOpened(true); }}>미리보기</button>
                  </span>
                  {tutorial ? (
                    <span data-tut="create" style={{ display: "inline-block" }}>
                      <button type="button" className="cc-submit-btn" onClick={() => setTutCreated(true)}>
                        대회 생성
                      </button>
                    </span>
                  ) : certification ? (
                    <button type="button" className="cc-next-btn" onClick={handleNextStep}>다음 단계 (검수자 설정) →</button>
                  ) : (
                    <button type="button" className="cc-submit-btn" onClick={handleSubmit} disabled={!validationPassed}>
                      결제 후 생성
                    </button>
                  )}
                  <button type="button" className="cc-cancel-btn" onClick={() => navigate("battle")}>취소</button>
                </div>
              </div>
            </div>

            {/* ── 체크리스트 + 비용 컬럼 ── */}
            <aside className="cc-checklist-col" data-tut="checklist">
              {/* 비용 배너 — 튜토리얼에서는 숨김 */}
              {!tutorial && (
                <div className="cc-cost-banner">
                  <span className="cc-cost-banner-label">결제 금액</span>
                  <span className="cc-cost-banner-amount">
                    {(certification ? PAYMENT_AMOUNT.certified : PAYMENT_AMOUNT.uncertified).toLocaleString()}
                    <span className="cc-cost-banner-unit">원</span>
                  </span>
                  <span className="cc-cost-banner-type">
                    {certification ? "인증 대회" : "비인증 대회"}
                  </span>
                </div>
              )}
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

      {/* ── 튜토리얼 오버레이 ── */}
      {tutorial && (
        <ContestTutorial
          snap={tutSnap}
          previewOpen={showPreview}
          applyFile={applyTutorialFile}
          setUncertified={() => setCertification(false)}
          onFinish={() => navigate("battle")}
        />
      )}
    </div>
  );
};

export default BattleCreateContestPage;
