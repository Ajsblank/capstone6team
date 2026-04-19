import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useApp } from "../context/AppContext";
import AppHeader from "../components/AppHeader";
import { getAlgorithm, AlgorithmProblemResponse } from "../api/algorithmApi";
import "./AppLayout.css";
import "./AlgoProblemDetailPage.css";

function getProblemIdFromHash(): number | null {
  const parts = window.location.hash.replace("#", "").split("/");
  if (parts[0] === "problem-detail" && parts[1]) {
    const id = parseInt(parts[1], 10);
    return isNaN(id) ? null : id;
  }
  return null;
}

const AlgoProblemDetailPage: React.FC = () => {
  const { navigate } = useApp();
  const [problem, setProblem] = useState<AlgorithmProblemResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = getProblemIdFromHash();

    if (id === null) {
      setError("문제 ID를 찾을 수 없습니다.");
      setLoading(false);
      return;
    }

    getAlgorithm(id)
      .then((data) => setProblem(data))
      .catch(() => setError("문제를 불러오는 데 실패했습니다."))
      .finally(() => setLoading(false));
  }, []);

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

  if (error || !problem) {
    return (
      <div className="home-page">
        <AppHeader activePage="problems" />
        <main className="home-body">
          <div className="pd-error">
            <p>{error || "문제를 찾을 수 없습니다."}</p>
            <button className="pd-back-btn" onClick={() => navigate("problems")}>목록으로</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="home-page">
      <AppHeader activePage="problems" />
      <main className="home-body">
        <div className="pd-content">

          {/* 뒤로가기 */}
          <button className="pd-back-btn" onClick={() => navigate("problems")}>← 목록으로</button>

          {/* 문제 번호 + 제목 */}
          <div className="pd-header">
            <span className="pd-number">#{problem.id}</span>
            <h1 className="pd-title">{problem.title}</h1>
          </div>

          {/* 제한 명세 */}
          <div className="pd-constraints">
            <span className="pd-constraint-item">⏱ 시간 제한: {problem.timeLimitSec}초</span>
            <span className="pd-constraint-item">💾 메모리 제한: {problem.memoryLimitMB}MB</span>
          </div>

          {/* 문제 설명 */}
          <section className="pd-section">
            <h2 className="pd-section-title">문제</h2>
            <div className="pd-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{problem.description}</ReactMarkdown>
            </div>
          </section>

          {/* 입력 설명 */}
          <section className="pd-section">
            <h2 className="pd-section-title">입력</h2>
            <div className="pd-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{problem.inputDescription}</ReactMarkdown>
            </div>
          </section>

          {/* 출력 설명 */}
          <section className="pd-section">
            <h2 className="pd-section-title">출력</h2>
            <div className="pd-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{problem.outputDescription}</ReactMarkdown>
            </div>
          </section>

          {/* 예제 입출력 */}
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
    </div>
  );
};

export default AlgoProblemDetailPage;
