import React from "react";
import { Problem } from "../types";
import "./ProblemPanel.css";

interface Props {
  problem: Problem;
}

const ProblemPanel: React.FC<Props> = ({ problem }) => {
  return (
    <div className="problem-panel">
      <div className="problem-header">
        <h1 className="problem-title">{problem.title}</h1>
        <div className="problem-meta">
          <span>시간 제한: {problem.timeLimit}ms</span>
          <span>메모리 제한: {problem.memoryLimit}MB</span>
        </div>
      </div>

      <section className="problem-section">
        <h2>문제 설명</h2>
        <p>{problem.description}</p>
      </section>

      <section className="problem-section">
        <h2>입력 형식</h2>
        <p>{problem.inputFormat}</p>
      </section>

      <section className="problem-section">
        <h2>출력 형식</h2>
        <p>{problem.outputFormat}</p>
      </section>

      {problem.examples.map((ex, idx) => (
        <section className="problem-section" key={idx}>
          <h2>예제 {idx + 1}</h2>
          <div className="example-grid">
            <div>
              <h3>입력</h3>
              <pre>{ex.input}</pre>
            </div>
            <div>
              <h3>출력</h3>
              <pre>{ex.output}</pre>
            </div>
          </div>
        </section>
      ))}

      <section className="problem-section">
        <h2>제약 조건</h2>
        <ul>
          {problem.constraints.map((c, idx) => (
            <li key={idx}>{c}</li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default ProblemPanel;
