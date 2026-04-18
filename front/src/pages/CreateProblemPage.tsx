import React, { useState, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useApp } from "../context/AppContext";
import AppHeader from "../components/AppHeader";
import { createAlgorithm, TestCaseDto } from "../api/algorithmApi";
import "./HomePage.css";
import "./CreateProblemPage.css";

// ── Required asterisk ──
const Req: React.FC<{ show: boolean }> = ({ show }) =>
  show ? <span className="cp-required">*</span> : null;

// ── Toast notification ──
interface ToastProps { messages: string[]; onClose: () => void; }
const Toast: React.FC<ToastProps> = ({ messages, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="cp-toast">
      <span className="cp-toast-icon">⚠</span>
      <div className="cp-toast-body">
        <strong>필수 항목을 입력해주세요</strong>
        <ul className="cp-toast-list">
          {messages.map((m) => <li key={m}>{m}</li>)}
        </ul>
      </div>
      <button className="cp-toast-close" onClick={onClose}>✕</button>
    </div>
  );
};

// ── Markdown editor component ──
interface MdEditorProps {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}

const MdEditor: React.FC<MdEditorProps> = ({ value, onChange, rows = 6, placeholder }) => {
  const [tab, setTab] = useState<"write" | "preview">("write");

  return (
    <div className="cp-md-editor">
      <div className="cp-md-tabs">
        <button
          type="button"
          className={`cp-md-tab${tab === "write" ? " cp-md-tab--active" : ""}`}
          onClick={() => setTab("write")}
        >
          편집
        </button>
        <button
          type="button"
          className={`cp-md-tab${tab === "preview" ? " cp-md-tab--active" : ""}`}
          onClick={() => setTab("preview")}
        >
          미리보기
        </button>
      </div>

      {tab === "write" ? (
        <textarea
          className="cp-md-textarea"
          rows={rows}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : value.trim() ? (
        <div className="cp-md-preview">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
        </div>
      ) : (
        <div className="cp-md-empty">미리볼 내용이 없습니다.</div>
      )}
    </div>
  );
};

// ── helpers (컴포넌트 외부 — 렌더링마다 재생성되지 않음) ──
const emptyTestCase = (): TestCaseDto => ({ input: "", output: "" });

function updateTestCase(
  list: TestCaseDto[],
  setList: React.Dispatch<React.SetStateAction<TestCaseDto[]>>,
  index: number,
  field: keyof TestCaseDto,
  value: string
) {
  setList(list.map((tc, i) => (i === index ? { ...tc, [field]: value } : tc)));
}

function addTestCase(setList: React.Dispatch<React.SetStateAction<TestCaseDto[]>>) {
  setList((prev) => [...prev, emptyTestCase()]);
}

function removeTestCase(
  list: TestCaseDto[],
  setList: React.Dispatch<React.SetStateAction<TestCaseDto[]>>,
  index: number
) {
  if (list.length > 1) setList(list.filter((_, i) => i !== index));
}

// ── page ──
const CreateProblemPage: React.FC = () => {
  const { navigate } = useApp();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [inputDescription, setInputDescription] = useState("");
  const [outputDescription, setOutputDescription] = useState("");
  const [memoryLimitMB, setMemoryLimitMB] = useState<number>(256);
  const [timeLimitSec, setTimeLimitSec] = useState<number>(1);
  const [exampleTestcases, setExampleTestcases] = useState<TestCaseDto[]>([emptyTestCase()]);
  const [hiddenTestcases, setHiddenTestcases] = useState<TestCaseDto[]>([emptyTestCase()]);

  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [toastMessages, setToastMessages] = useState<string[]>([]);

  const handleSubmit = async () => {
    const missing: string[] = [];
    if (!title.trim())             missing.push("제목");
    if (!description.trim())       missing.push("문제 설명");
    if (!inputDescription.trim())  missing.push("입력 설명");
    if (!outputDescription.trim()) missing.push("출력 설명");
    if (missing.length > 0) { setToastMessages(missing); return; }

    setStatus("submitting");
    setErrorMsg("");

    try {
      await createAlgorithm({
        title: title.trim(),
        description: description.trim(),
        inputDescription: inputDescription.trim(),
        outputDescription: outputDescription.trim(),
        memoryLimitMB,
        timeLimitSec,
        exampleTestcases,
        hiddenTestcases,
      });
      setStatus("success");
    } catch (err: unknown) {
      setStatus("error");
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

  const renderTestCaseSection = (
    label: string,
    list: TestCaseDto[],
    setList: React.Dispatch<React.SetStateAction<TestCaseDto[]>>
  ) => (
    <section className="cp-section">
      <h3 className="cp-section-title">{label}</h3>
      <div className="cp-testcase-list">
        {list.map((tc, i) => (
          <div key={i} className="cp-testcase-item">
            <span className="cp-testcase-index">{i + 1}</span>
            <div className="cp-testcase-fields">
              <div className="cp-field">
                <label className="cp-label">입력</label>
                <textarea
                  className="cp-tc-textarea"
                  rows={3}
                  placeholder="입력값"
                  value={tc.input}
                  onChange={(e) => updateTestCase(list, setList, i, "input", e.target.value)}
                />
              </div>
              <div className="cp-field">
                <label className="cp-label">출력</label>
                <textarea
                  className="cp-tc-textarea"
                  rows={3}
                  placeholder="출력값"
                  value={tc.output}
                  onChange={(e) => updateTestCase(list, setList, i, "output", e.target.value)}
                />
              </div>
            </div>
            <button
              className="cp-testcase-remove"
              onClick={() => removeTestCase(list, setList, i)}
              disabled={list.length === 1}
              title="삭제"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button className="cp-add-btn" onClick={() => addTestCase(setList)}>
        + 추가
      </button>
    </section>
  );

  return (
    <div className="create-problem-page">
      {toastMessages.length > 0 && (
        <Toast messages={toastMessages} onClose={() => setToastMessages([])} />
      )}
      <AppHeader activePage="problems" />

      <main className="home-body">
        <div className="cp-content">
          <h2 className="cp-page-title">문제 만들기</h2>

          <div className="cp-form">
            {/* 기본 정보 */}
            <section className="cp-section">
              <h3 className="cp-section-title">기본 정보</h3>
              <div className="cp-field">
                <label className="cp-label">제목 <Req show={!title.trim()} /></label>
                <input
                  className="cp-input"
                  type="text"
                  placeholder="문제 제목"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="cp-field">
                <label className="cp-label">문제 설명 <Req show={!description.trim()} /></label>
                <MdEditor
                  value={description}
                  onChange={setDescription}
                  rows={8}
                  placeholder="문제를 설명해주세요. Markdown을 지원합니다."
                />
              </div>
            </section>

            {/* 입출력 설명 */}
            <section className="cp-section">
              <h3 className="cp-section-title">입출력 설명</h3>
              <div className="cp-field">
                <label className="cp-label">입력 설명 <Req show={!inputDescription.trim()} /></label>
                <MdEditor
                  value={inputDescription}
                  onChange={setInputDescription}
                  rows={4}
                  placeholder="입력 형식을 설명해주세요."
                />
              </div>
              <div className="cp-field">
                <label className="cp-label">출력 설명 <Req show={!outputDescription.trim()} /></label>
                <MdEditor
                  value={outputDescription}
                  onChange={setOutputDescription}
                  rows={4}
                  placeholder="출력 형식을 설명해주세요."
                />
              </div>
            </section>

            {/* 제한 */}
            <section className="cp-section">
              <h3 className="cp-section-title">제한</h3>
              <div className="cp-row">
                <div className="cp-field">
                  <label className="cp-label">메모리 제한 (MB)</label>
                  <input
                    className="cp-input"
                    type="number"
                    min={16}
                    max={1024}
                    value={memoryLimitMB}
                    onChange={(e) => setMemoryLimitMB(Number(e.target.value))}
                  />
                </div>
                <div className="cp-field">
                  <label className="cp-label">시간 제한 (초)</label>
                  <input
                    className="cp-input"
                    type="number"
                    min={1}
                    max={10}
                    value={timeLimitSec}
                    onChange={(e) => setTimeLimitSec(Number(e.target.value))}
                  />
                </div>
              </div>
            </section>

            {renderTestCaseSection("예제 입출력", exampleTestcases, setExampleTestcases)}
            {renderTestCaseSection("히든 테스트케이스", hiddenTestcases, setHiddenTestcases)}

            <div className="cp-submit-area">
              <button
                className="cp-submit-btn"
                onClick={handleSubmit}
                disabled={status === "submitting" || status === "success"}
              >
                {status === "submitting" ? "제출 중..." : status === "success" ? "제출 완료" : "문제 등록"}
              </button>
              <button className="cp-cancel-btn" onClick={() => navigate("problems")}>
                취소
              </button>
              {status === "error" && <span className="cp-error-msg">{errorMsg}</span>}
              {status === "success" && <span className="cp-success-msg">문제가 성공적으로 등록되었습니다.</span>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CreateProblemPage;
