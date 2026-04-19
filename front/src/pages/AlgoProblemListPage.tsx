import React, { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import AppHeader from "../components/AppHeader";
import { getAlgorithmList, AlgorithmProblemResponse } from "../api/algorithmApi";
import "./AppLayout.css";

const ProblemsPage: React.FC = () => {
  const { navigate } = useApp();
  const [problems, setProblems] = useState<AlgorithmProblemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getAlgorithmList()
      .then(setProblems)
      .catch(() => setError("문제 목록을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="home-page">
      <AppHeader activePage="problems" />

      <main className="home-body">
        <div className="problems-content">
          <div className="problems-toolbar">
            <h2 className="problems-title">문제 목록</h2>
            <button
              className="home-auth-btn home-auth-btn--primary"
              onClick={() => navigate("create-problem")}
            >
              + 문제 만들기
            </button>
          </div>

          {loading && (
            <div className="problems-status">불러오는 중...</div>
          )}

          {!loading && error && (
            <div className="problems-status problems-status--error">{error}</div>
          )}

          {!loading && !error && problems.length === 0 && (
            <div className="problems-status">등록된 문제가 없습니다.</div>
          )}

          {!loading && !error && problems.length > 0 && (
            <table className="problems-table">
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>#</th>
                  <th>제목</th>
                  <th style={{ width: "110px" }}>시간 제한</th>
                  <th style={{ width: "110px" }}>메모리 제한</th>
                </tr>
              </thead>
              <tbody>
                {problems.map((p) => (
                  <tr
                    key={p.id}
                    className="problems-row"
                    onClick={() => { window.location.hash = `problem-detail/${p.id}`; }}
                  >
                    <td style={{ color: "#6c7086" }}>{p.id}</td>
                    <td className="problems-row-title">{p.title}</td>
                    <td style={{ color: "#a6adc8" }}>{p.timeLimitSec}초</td>
                    <td style={{ color: "#a6adc8" }}>{p.memoryLimitMB}MB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProblemsPage;
