import React, { useState, useEffect, useRef } from "react";
import { marked } from "marked";
import mammoth from "mammoth";
import { useApp } from "../context/AppContext";
import BattleTopNav from "../components/BattleTopNav";
import Breadcrumb from "../components/Breadcrumb";
import { ContestStatus, AiCodeEntry, extToLanguage } from "../api/contestApi";
import { setContestDraft } from "../contestDraft";
import {
  PAYMENT_AMOUNT, buildDraft, saveDraft, requestTossPayment,
  loadDraft, clearDraft, deserializeFile,
} from "../api/paymentApi";
import { validateContestCode, subscribeToValidationResults, unsubscribeFromValidationResults, ValidationResult } from "../api/validationApi";
import { setTestResultCallback } from "../api/sseApi";
import ContestSidebar from "../components/ContestSidebar";
import RichTextEditor from "../components/RichTextEditor";
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

function stepPow2(n: number, dir: 1 | -1, min = 128, max = 512): number {
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
  const { user, navigate } = useApp();

  const [title, setTitle]                   = useState("");
  const [description, setDescription]       = useState("");
  const [timeLimitSec, setTimeLimitSec]     = useState<number>(10);
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
  const [validationLogs, setValidationLogs] = useState<string[]>([]);
  const [loadingDots, setLoadingDots]       = useState(1);

  // 검증 완료 상태 (필수 파일 3개 검증 완료)
  const [validationPassed, setValidationPassed] = useState(false);



  // 결제 실패 후 복구 토스트
  const [restoreToast, setRestoreToast] = useState(false);

  // 로딩 애니메이션 (점 깜박임)
  useEffect(() => {
    if (!isValidating) return;
    const interval = setInterval(() => {
      setLoadingDots(prev => (prev === 3 ? 1 : prev + 1));
    }, 500);
    return () => clearInterval(interval);
  }, [isValidating]);

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
      // 튜토리얼 파일 로드 실패 무시
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
    setValidationPassed(false);
    setValidationResult(null);
  };
  const handleSampleCodeRemove = (i: number) => {
    setSampleCodes(prev => prev.filter((_, idx) => idx !== i));
    setValidationPassed(false);
    setValidationResult(null);
  };

  const handleAICodeAdd = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setExampleAiCodes(prev => [
      ...prev,
      ...Array.from(files).map(file => ({ file, description: "" })),
    ]);
    setAiCodeInputKey(k => k + 1);
    setValidationPassed(false);
    setValidationResult(null);
  };
  const handleAICodeRemove = (i: number) => {
    setExampleAiCodes(prev => prev.filter((_, idx) => idx !== i));
    setValidationPassed(false);
    setValidationResult(null);
  };
  const handleAICodeDescChange = (i: number, desc: string) => {
    setExampleAiCodes(prev => prev.map((e, idx) => idx === i ? { ...e, description: desc } : e));
    // 설명도 검증 payload에 포함되므로 변경 시 재검증 필요
    setValidationPassed(false);
    setValidationResult(null);
  };

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
    setValidationLogs([]);
    setShowValidation(true);   // 검증 로그 팝업 열기 (로딩 → 결과/에러 로그 표시)
    setTestResultCallback((log) => setValidationLogs(prev => [...prev, log]));

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
          setTestResultCallback(null);
          setValidationResult(result);
          setIsValidating(false);

          if (result.passed) {
            setValidationPassed(true);
          } else {
            const hasErrorLog = result.details?.some(d => /error/i.test(d.log || ""));
            if (hasErrorLog) {
              unsubscribeFromValidationResults();
            }
          }
        },
        (error) => {
          setTestResultCallback(null);
          setErrorMsg(error.message);
          setIsValidating(false);
          setShowValidation(false);
        }
      );
    } catch (err: any) {
      setTestResultCallback(null);
      const msg = err?.message ?? "검증 요청 중 오류가 발생했습니다.";
      setErrorMsg(msg);
      setValidationResult({
        passed: false,
        details: [{ target: "검증 요청", passed: false, log: msg, reason: msg }],
      });
      setIsValidating(false);
    }
  };

  // 튜토리얼 모드: Mock 검증 — 실제 흐름과 동일하게 검증 결과 모달(ValidationResultModal)을 사용
  const handleTutorialValidation = async () => {
    setIsValidating(true);
    setValidationResult(null);
    setShowValidation(true);   // 모달 열기(로딩 → 성공)
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsValidating(false);
    setValidationResult({
      passed: true,
      details: [{ target: "튜토리얼 검증", passed: true, log: "[튜토리얼] 채점·샘플·예시 AI 코드가 모두 정상적으로 실행되었습니다." }],
    });
    setValidationPassed(true);
  };

  // 검증 실패 시 재검증
  const handleRetryValidation = () => {
    setValidationResult(null);
    setValidationPassed(false);
    handleValidateAndCreate();
  };

  // 비인증 — 결제 확인 모달 열기
  const handleSubmit = () => {
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
    validationCompleted: validationPassed,                       // 검증 성공(모달에 성공 표시)
    validationModalOpen: showValidation,                         // 검증 버튼을 눌러 모달이 열림
    validationModalClosed: validationPassed && !showValidation,  // 성공 후 "계속하기"로 모달을 닫음
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
        streamLogs={validationLogs}
        onClose={() => {
          setTestResultCallback(null);
          setShowValidation(false);
          unsubscribeFromValidationResults();
        }}
        onRetry={handleRetryValidation}
      />

      {/* 결제 확인 모달 */}
      {showPayConfirm && (
        <div
          className="cc-modal-overlay"
          onClick={() => !payLoading && setShowPayConfirm(false)}
          onTouchEnd={(e) => { if (e.target === e.currentTarget && !payLoading) setShowPayConfirm(false); }}
        >
          <div className="cc-modal cc-pay-modal" onClick={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
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

      <BattleTopNav spacer />

      <main className="home-body">
        <div className="cc-content">
          <div className="cc-layout">

            {/* ── 폼 컬럼 ── */}
            <div className="cc-form-col">
              <Breadcrumb items={[
                { label: "대회 목록", onClick: () => navigate("battle") },
                { label: "대회 개최" },
              ]} />
              <h2 className="cc-page-title">대회 개최{tutorial && " (튜토리얼)"}</h2>

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
                      <input className="cc-input" type="number" min={10} max={60} value={timeLimitSec} onChange={(e) => setTimeLimitSec(Number(e.target.value))} />
                    </div>
                    <div className="cc-field">
                      <label className="cc-label">메모리 제한 (MB) <span className="cc-required">*</span></label>
                      <div className="cc-pow2-wrap">
                        <input
                          className="cc-input cc-input--pow2"
                          type="number"
                          min={128}
                          max={512}
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

                {/* 코드 파일 */}
                <section className="cc-section">
                  <h3 className="cc-section-title">코드 파일</h3>
                  {/* 검증 중에는 검증 대상 파일 3종(샘플/채점/예시 AI) 상호작용 차단 */}
                  <div className={isValidating ? "cc-section--disabled" : ""}>
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
                    <FileInput
                      label="채점 코드"
                      required
                      accept=".py,.cpp,.java,.js,.ts"
                      value={judgeCode}
                      onChange={(file) => {
                        setJudgeCode(file);
                        setValidationPassed(false);
                        setValidationResult(null);
                      }}
                    />
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
                  </div>{/* /검증 중 비활성화 래퍼 */}

                  {/* 검증 버튼 - 필수 파일 3개 모두 업로드 후 표시 */}
                  {areRequiredFilesUploaded() && (
                    <div className="cc-validate-btn-wrapper">
                      <button
                        type="button"
                        className="cc-validate-btn"
                        onClick={tutorial ? handleTutorialValidation : handleValidateAndCreate}
                        disabled={isValidating}
                        data-tut="validate"
                      >
                        {isValidating ? `검증 중${".".repeat(loadingDots)}` : "코드 검증"}
                      </button>
                    </div>
                  )}
                </section>

                {/* 검증 통과 전 안내 — 시각화/대회 설정 입력 잠금 */}
                {!validationPassed && (
                  <p className="cc-validate-lock-hint">
                    🔒 코드 검증을 통과해야 시각화 파일과 대회 설정을 입력할 수 있습니다.
                  </p>
                )}

                {/* 시각화 파일 — 검증 통과 후 입력 가능 */}
                <section className={`cc-section${!validationPassed ? " cc-section--disabled" : ""}`} data-tut="viz">
                  <h3 className="cc-section-title">시각화 파일</h3>
                  <FileInput label="시각화 HTML 파일" accept=".html" value={visualizationHtml} onChange={setVisualizationHtml} required={certification} hint={!certification ? " (선택)" : undefined} />
                  <FileInput label="혼자서 플레이 HTML 파일" accept=".html" value={soloPlayHtml} onChange={setSoloPlayHtml} required={certification} hint={!certification ? " (선택)" : undefined} />
                </section>

                {/* 대회 설정 — 검증 통과 후 입력 가능 */}
                <section className={`cc-section${!validationPassed ? " cc-section--disabled" : ""}`}>
                  <h3 className="cc-section-title">대회 설정</h3>
                  <div className="cc-row" data-tut="date">
                    <div className="cc-field">
                      <label className="cc-label">시작 일시 <Req show={!startDate} /></label>
                      <input className="cc-input cc-input--date" type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="cc-field">
                      <label className="cc-label">종료 일시 <Req show={!endDate} /></label>
                      <input className="cc-input cc-input--date" type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                  </div>
                  <div className="cc-field cc-field--narrow" data-tut="max">
                    <label className="cc-label">최대 참가자 수 <span className="cc-required">*</span></label>
                    <input className="cc-input" type="number" min={1} max={10000} value={maxParticipants} onChange={(e) => setMaxParticipants(Number(e.target.value))} />
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
                    <button type="button" className="cc-submit-btn" onClick={handleSubmit}>
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
