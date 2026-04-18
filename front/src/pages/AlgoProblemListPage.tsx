import React from "react";
import { useApp } from "../context/AppContext";
import AppHeader from "../components/AppHeader";
import "./AppLayout.css";

// TODO: 백엔드 API 연동 시 타입 수정
interface Problem {
  id: number;
  title: string;
  difficulty: "브론즈" | "실버" | "골드" | "플래티넘" | "다이아";
  category: string;
  solvedCount: number;
}

const DIFFICULTY_COLOR: Record<Problem["difficulty"], string> = {
  브론즈:   "#cd7f32",
  실버:     "#9ba3aa",
  골드:     "#e5b000",
  플래티넘: "#5eb9c9",
  다이아:   "#a9d8f7",
};

// TODO: 백엔드 /api/problems 호출 결과로 교체
const MOCK_PROBLEMS: Problem[] = [
  { id: 1, title: "두 수의 합",         difficulty: "브론즈",   category: "수학",       solvedCount: 12804 },
  { id: 2, title: "소수 판별",           difficulty: "실버",     category: "수학",       solvedCount:  8321 },
  { id: 3, title: "최단 경로",           difficulty: "골드",     category: "그래프",     solvedCount:  4590 },
  { id: 4, title: "구간 합 쿼리",        difficulty: "골드",     category: "자료구조",   solvedCount:  3017 },
  { id: 5, title: "LCS",               difficulty: "골드",     category: "다이나믹",   solvedCount:  2748 },
  { id: 6, title: "세그먼트 트리",       difficulty: "플래티넘", category: "자료구조",   solvedCount:  1203 },
  { id: 7, title: "네트워크 플로우",     difficulty: "플래티넘", category: "그래프",     solvedCount:   874 },
  { id: 8, title: "볼록 껍질",           difficulty: "다이아",   category: "기하",       solvedCount:   341 },
];

const ProblemsPage: React.FC = () => {
  const { navigate } = useApp();

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

          {/* TODO: MOCK_PROBLEMS를 백엔드 /api/problems 응답으로 교체 */}
          <table className="problems-table">
            <thead>
              <tr>
                <th style={{ width: "60px" }}>#</th>
                <th>제목</th>
                <th style={{ width: "100px" }}>난이도</th>
                <th style={{ width: "120px" }}>분류</th>
                <th style={{ width: "90px", textAlign: "right" }}>풀이 수</th>
              </tr>
            </thead>
            <tbody>
              {/* TODO: MOCK_PROBLEMS → getAlgorithmList() 결과로 교체 */}
              {MOCK_PROBLEMS.map((p) => (
                <tr
                  key={p.id}
                  className="problems-row"
                  onClick={() => { window.location.hash = `problem-detail/${p.id}`; }}
                >
                  <td style={{ color: "#6c7086" }}>{p.id}</td>
                  <td className="problems-row-title">{p.title}</td>
                  <td>
                    <span style={{ color: DIFFICULTY_COLOR[p.difficulty], fontWeight: 600 }}>
                      {p.difficulty}
                    </span>
                  </td>
                  <td style={{ color: "#a6adc8" }}>{p.category}</td>
                  <td style={{ textAlign: "right", color: "#6c7086" }}>
                    {p.solvedCount.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default ProblemsPage;
