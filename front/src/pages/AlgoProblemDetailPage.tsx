import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useApp } from "../context/AppContext";
import AppHeader from "../components/AppHeader";
import CodeEditor, { LANGUAGE_DEFAULTS } from "../components/CodeEditor";
import SubmitBar from "../components/SubmitBar";
import SubmitSuccessModal from "../components/SubmitSuccessModal";
import { getAlgorithm, AlgorithmProblemResponse, submitAlgoCode, AlgoSubmission } from "../api/algorithmApi";
import { Language } from "../types";
import "./AppLayout.css";
import "./AlgoProblemDetailPage.css";

type Tab = "problem" | "submit" | "my-submissions";

const LANGUAGE_LABELS: Record<string, string> = { cpp: "C++", java: "Java", python: "Python" };

function formatDate(d: Date): string {
  return d.toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

const VERDICT_MAP: Record<string, { label: string; cls: string }> = {
  ACCEPTED:              { label: "맞았습니다",  cls: "pd-verdict--accepted" },
  WRONG_ANSWER:          { label: "틀렸습니다",  cls: "pd-verdict--wrong"    },
  COMPILE_ERROR:         { label: "컴파일 에러", cls: "pd-verdict--error"    },
  RUNTIME_ERROR:         { label: "런타임 에러", cls: "pd-verdict--error"    },
  TIME_LIMIT_EXCEEDED:   { label: "시간 초과",   cls: "pd-verdict--tle"      },
  MEMORY_LIMIT_EXCEEDED: { label: "메모리 초과", cls: "pd-verdict--tle"      },
};

function verdictInfo(v: string | null): { label: string; cls: string } {
  if (!v) return { label: "처리중", cls: "pd-verdict--pending" };
  return VERDICT_MAP[v.toUpperCase()] ?? { label: v, cls: "pd-verdict--pending" };
}
type SubmitStatus = "idle" | "submitting" | "success" | "error";

function getProblemIdFromHash(): number | null {
  const parts = window.location.hash.replace("#", "").split("/");
  if (parts[0] === "problem-detail" && parts[1]) {
    const id = parseInt(parts[1], 10);
    return isNaN(id) ? null : id;
  }
  return null;
}

const AlgoProblemDetailPage: React.FC = () => {
  const { navigate, user } = useApp();

  // ── 문제 데이터 ──
  const [problem, setProblem] = useState<AlgorithmProblemResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  // ── 탭 ──
  const [activeTab, setActiveTab] = useState<Tab>("problem");

  // ── 제출 ──
  const [language, setLanguage] = useState<Language>("cpp");
  const [code, setCode] = useState<string>(LANGUAGE_DEFAULTS["cpp"]);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState("");
  const [responseMessage, setResponseMessage] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submissions, setSubmissions] = useState<AlgoSubmission[]>([]);

  useEffect(() => {
    const id = getProblemIdFromHash();
    if (id === null) {
      setFetchError("문제 ID를 찾을 수 없습니다.");
      setLoading(false);
      return;
    }
    getAlgorithm(id)
      .then((data) => setProblem(data))
      .catch(() => setFetchError("문제를 불러오는 데 실패했습니다."))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    if (!code.trim()) return;
    const submittedAt = new Date();
    const codeSize = new Blob([code]).size;
    setSubmitStatus("submitting");
    setSubmitError("");
    try {
      const result = await submitAlgoCode({
        userId: user?.id ?? "guest",
        problemId: String(problem!.id),
        language,
        sourceCode: code,
      });
      setSubmissions(prev => [{
        submittedAt,
        language,
        codeSize,
        verdict: result.verdict ?? null,
        memoryMb: result.memoryMb ?? null,
        cpuMs: result.cpuMs ?? null,
        submissionId: result.submissionId,
      }, ...prev]);
      setResponseMessage(result.message);
      setSubmitStatus("success");
      setShowSuccessModal(true);
    } catch (err: any) {
      setSubmitStatus("error");
      if (err.response) {
        setSubmitError(`[${err.response.status}] ${err.response.data?.message ?? err.response.statusText}`);
      } else if (err.request) {
        setSubmitError("서버에 연결할 수 없습니다. 네트워크 또는 CORS를 확인하세요.");
      } else {
        setSubmitError(err.message ?? "알 수 없는 오류가 발생했습니다.");
      }
    }
  };

  // ── 로딩 / 에러 화면 ──
  if (loading) {
    return (
      <div className="home-page">
        <AppHeader activePage="problems" />
        <main className="home-body">
          <div className="pd-loading">불러오는 중...</div>
        </main>
      </div>
    );
  }

  if (fetchError || !problem) {
    return (
      <div className="home-page">
        <AppHeader activePage="problems" />
        <main className="home-body">
          <div className="pd-error">
            <p>{fetchError || "문제를 찾을 수 없습니다."}</p>
            <button className="pd-back-btn" onClick={() => navigate("problems")}>목록으로</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="home-page pd-detail-page">
      {showSuccessModal && (
        <SubmitSuccessModal
          message={responseMessage}
          onClose={() => { setShowSuccessModal(false); setSubmitStatus("idle"); setActiveTab("my-submissions"); }}
        />
      )}

      <AppHeader activePage="problems" />

      {/* 탭 바 */}
      <div className="pd-tab-bar">
        <button
          className={`pd-tab-btn${activeTab === "problem" ? " pd-tab-btn--active" : ""}`}
          onClick={() => setActiveTab("problem")}
        >
          문제
        </button>
        <button
          className={`pd-tab-btn${activeTab === "submit" ? " pd-tab-btn--active" : ""}`}
          onClick={() => setActiveTab("submit")}
        >
          제출
        </button>
        <button
          className={`pd-tab-btn${activeTab === "my-submissions" ? " pd-tab-btn--active" : ""}`}
          onClick={() => setActiveTab("my-submissions")}
        >
          내 제출
        </button>
        <div className="pd-tab-bar-meta">
          <span className="pd-tab-bar-title">#{problem.id} {problem.title}</span>
          <button className="pd-back-btn" onClick={() => navigate("problems")}>← 목록으로</button>
        </div>
      </div>

      {/* 문제 탭 */}
      {activeTab === "problem" && (
        <main className="home-body pd-problem-panel">
          <div className="pd-content">
            <div className="pd-header">
              <span className="pd-number">#{problem.id}</span>
              <h1 className="pd-title">{problem.title}</h1>
            </div>

            <div className="pd-constraints">
              <span className="pd-constraint-item">⏱ 시간 제한: {problem.timeLimitSec}초</span>
              <span className="pd-constraint-item">💾 메모리 제한: {problem.memoryLimitMB}MB</span>
            </div>

            <section className="pd-section">
              <h2 className="pd-section-title">문제</h2>
              <div className="pd-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{problem.description}</ReactMarkdown>
              </div>
            </section>

            <section className="pd-section">
              <h2 className="pd-section-title">입력</h2>
              <div className="pd-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{problem.inputDescription}</ReactMarkdown>
              </div>
            </section>

            <section className="pd-section">
              <h2 className="pd-section-title">출력</h2>
              <div className="pd-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{problem.outputDescription}</ReactMarkdown>
              </div>
            </section>

            {problem.exampleTestcases.length > 0 && (
              <section className="pd-section">
                <h2 className="pd-section-title">예제</h2>
                <div className="pd-examples">
                  {problem.exampleTestcases.map((tc, i) => (
                    <div key={i} className="pd-example">
                      <div className="pd-example-col">
                        <div className="pd-example-label">입력 {i + 1}</div>
                        <pre className="pd-example-code">{tc.input}</pre>
                      </div>
                      <div className="pd-example-col">
                        <div className="pd-example-label">출력 {i + 1}</div>
                        <pre className="pd-example-code">{tc.output}</pre>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </main>
      )}

      {/* 제출 탭 */}
      {activeTab === "submit" && (
        <main className="home-body pd-submit-panel">
          <div className="pd-editor-wrap">
            <CodeEditor
              language={language}
              code={code}
              onLanguageChange={(lang) => {
                setLanguage(lang);
                setCode(LANGUAGE_DEFAULTS[lang]);
              }}
              onCodeChange={setCode}
            />
            <SubmitBar
              status={submitStatus}
              errorMessage={submitError}
              onSubmit={handleSubmit}
            />
          </div>
        </main>
      )}

      {/* 내 제출 탭 */}
      {activeTab === "my-submissions" && (
        <main className="home-body pd-my-submissions-panel">
          {submissions.length === 0 ? (
            <div className="pd-submissions-empty">아직 제출 이력이 없습니다.</div>
          ) : (
            <table className="pd-submissions-table">
              <thead>
                <tr>
                  <th>제출 일시</th>
                  <th>언어</th>
                  <th>코드 용량</th>
                  <th>메모리</th>
                  <th>CPU 시간</th>
                  <th>결과</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub, i) => {
                  const { label, cls } = verdictInfo(sub.verdict);
                  return (
                    <tr key={i}>
                      <td>{formatDate(sub.submittedAt)}</td>
                      <td>{LANGUAGE_LABELS[sub.language] ?? sub.language}</td>
                      <td>{formatSize(sub.codeSize)}</td>
                      <td>{sub.memoryMb != null ? `${sub.memoryMb} MB` : "-"}</td>
                      <td>{sub.cpuMs != null ? `${sub.cpuMs} ms` : "-"}</td>
                      <td><span className={`pd-verdict ${cls}`}>{label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </main>
      )}
    </div>
  );
};

export default AlgoProblemDetailPage;
