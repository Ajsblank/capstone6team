import React, { useEffect, useState, useCallback } from "react";
import { useApp } from "../context/AppContext";
import AppHeader from "../components/AppHeader";
import { getAlgorithmList, AlgorithmProblemListItem } from "../api/algorithmApi";
import "./AppLayout.css";

const PAGE_SIZE = 20;

type SortKey = "id-asc" | "id-desc" | "title-asc" | "title-desc";

const ProblemsPage: React.FC = () => {
  const { navigate } = useApp();
  const [problems, setProblems] = useState<AlgorithmProblemListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("id-asc");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await getAlgorithmList(p, PAGE_SIZE);
      setProblems(res.content);
      setTotalPages(res.totalPages);
      setPage(res.number);
    } catch {
      setError("문제 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPage(0); }, [fetchPage]);

  // 정렬 + 검색 적용
  let displayProblems = [...problems];
  const q = searchQuery.trim().toLowerCase();
  if (q) displayProblems = displayProblems.filter(p => p.title.toLowerCase().includes(q));
  switch (sortKey) {
    case "id-asc":    displayProblems.sort((a, b) => a.id - b.id); break;
    case "id-desc":   displayProblems.sort((a, b) => b.id - a.id); break;
    case "title-asc": displayProblems.sort((a, b) => a.title.localeCompare(b.title, "ko")); break;
    case "title-desc":displayProblems.sort((a, b) => b.title.localeCompare(a.title, "ko")); break;
  }

  return (
    <div className="home-page">
      <AppHeader activePage="problems" />

      <main className="home-body">
        <div className="problems-content">
          <div className="problems-toolbar">
            <h2 className="problems-title">문제 목록</h2>
            <div className="problems-controls">
              <select
                className="problems-filter"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
              >
                <option value="id-asc">번호 오름차순</option>
                <option value="id-desc">번호 내림차순</option>
                <option value="title-asc">제목 오름차순</option>
                <option value="title-desc">제목 내림차순</option>
              </select>
              <input
                className="problems-search"
                type="text"
                placeholder="제목 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                className="home-auth-btn home-auth-btn--primary"
                onClick={() => navigate("create-problem")}
              >
                + 문제 만들기
              </button>
            </div>
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

          {!loading && !error && problems.length > 0 && displayProblems.length === 0 && (
            <div className="problems-status">검색 결과가 없습니다.</div>
          )}

          {!loading && !error && displayProblems.length > 0 && (
            <table className="problems-table">
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>#</th>
                  <th>제목</th>
                </tr>
              </thead>
              <tbody>
                {displayProblems.map((p) => (
                  <tr
                    key={p.id}
                    className="problems-row"
                    onClick={() => { window.location.hash = `problem-detail/${p.id}`; }}
                  >
                    <td style={{ color: "#6c7086" }}>{p.id}</td>
                    <td className="problems-row-title">{p.title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {totalPages > 1 && (
            <div className="problems-pagination">
              <button
                className="problems-page-btn"
                disabled={page === 0 || loading}
                onClick={() => fetchPage(page - 1)}
              >
                ‹ 이전
              </button>
              <span className="problems-page-info">{page + 1} / {totalPages}</span>
              <button
                className="problems-page-btn"
                disabled={page >= totalPages - 1 || loading}
                onClick={() => fetchPage(page + 1)}
              >
                다음 ›
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProblemsPage;
