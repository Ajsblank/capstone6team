import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useApp } from "../context/AppContext";
import { createAlgorithm, TestCaseDto } from "../api/algorithmApi";
import "./HomePage.css";
import "./CreateProblemPage.css";

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

// ── helpers ──
const emptyTestCase = (): TestCaseDto => ({ input: "", output: "" });

// ── page ──
const CreateProblemPage: React.FC = () => {
  const { user, logout, navigate } = useApp();

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

  const updateTestCase = (
    list: TestCaseDto[],
    setList: React.Dispatch<React.SetStateAction<TestCaseDto[]>>,
    index: number,
    field: keyof TestCaseDto,
    value: string
  ) => setList(list.map((tc, i) => (i === index ? { ...tc, [field]: value } : tc)));

  const addTestCase = (setList: React.Dispatch<React.SetStateAction<TestCaseDto[]>>) =>
    setList((prev) => [...prev, emptyTestCase()]);

  const removeTestCase = (
    list: TestCaseDto[],
    setList: React.Dispatch<React.SetStateAction<TestCaseDto[]>>,
    index: number
  ) => list.length > 1 && setList(list.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (!title.trim()) { setErrorMsg("제목을 입력해주세요."); return; }
    if (!description.trim()) { setErrorMsg("문제 설명을 입력해주세요."); return; }

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
    } catch (err: any) {
      setStatus("error");
      if (err.response) {
        setErrorMsg(`[${err.response.status}] ${err.response.data?.message ?? err.response.statusText}`);
      } else if (err.request) {
        setErrorMsg("서버에 연결할 수 없습니다.");
      } else {
        setErrorMsg(err.message ?? "알 수 없는 오류가 발생했습니다.");
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
      <header className="home-header">
        <span className="home-logo" onClick={() => navigate("home")}>CodeBattle</span>
        <nav className="home-tab-nav">
          <button className="home-tab-btn" onClick={() => navigate("home")}>홈</button>
          <button className="home-tab-btn home-tab-btn--active" onClick={() => navigate("problems")}>문제</button>
          <button className="home-tab-btn">대회</button>
          <button className="home-tab-btn">도움말</button>
        </nav>
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
        <div className="cp-content">
          <h2 className="cp-page-title">문제 만들기</h2>

          <div className="cp-form">
            {/* 기본 정보 */}
            <section className="cp-section">
              <h3 className="cp-section-title">기본 정보</h3>
              <div className="cp-field">
                <label className="cp-label">제목</label>
                <input
                  className="cp-input"
                  type="text"
                  placeholder="문제 제목"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="cp-field">
                <label className="cp-label">문제 설명</label>
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
                <label className="cp-label">입력 설명</label>
                <MdEditor
                  value={inputDescription}
                  onChange={setInputDescription}
                  rows={4}
                  placeholder="입력 형식을 설명해주세요."
                />
              </div>
              <div className="cp-field">
                <label className="cp-label">출력 설명</label>
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
