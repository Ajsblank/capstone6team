import React, { useEffect, useState, useCallback } from "react";
import { getMySubmissions } from "../api/submissionApi";
import { SubmissionRecord, MatchResult } from "../types";
import "./MySubmissionsTab.css";

const CONTEST_ID = 1; // TODO: 다중 대회 지원 시 props로 수신
const PAGE_SIZE = 10;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function ResultBadge({ result }: { result: "WIN" | "LOSS" | "DRAW" }) {
  return (
    <span className={`ms-badge ms-badge--${result.toLowerCase()}`}>
      {result === "WIN" ? "승" : result === "LOSS" ? "패" : "무"}
    </span>
  );
}

function MatchDetail({ match }: { match: MatchResult }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="ms-match">
      <div className="ms-match-header" onClick={() => setOpen(v => !v)}>
        <ResultBadge result={match.result} />
        <span className="ms-match-opp">vs {match.opponentName}</span>
        <span className="ms-match-toggle">{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div className="ms-match-logs">
          {match.rounds.length === 0 ? (
            <div className="ms-empty">라운드 정보 없음</div>
          ) : (
            match.rounds.map(r => (
              <div key={r.round} className="ms-log-row">
                <span className="ms-log-round">R{r.round}</span>
                <span className="ms-log-cards">
                  나: {r.p1Cards.join(" › ")}
                </span>
                <span className="ms-log-cards">
                  AI: {r.p2Cards.join(" › ")}
                </span>
                <span className={`ms-log-result ms-log-result--${r.roundWinner}`}>
                  {r.roundWinner === "p1" ? "승" : r.roundWinner === "p2" ? "패" : "무"}
                </span>
                <span className="ms-log-hp">
                  HP {r.p1HpAfter} : {r.p2HpAfter}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SubmissionItem({ record }: { record: SubmissionRecord }) {
  const [open, setOpen] = useState(false);
  const total = record.wins + record.losses + record.draws;

  return (
    <div className="ms-item">
      <div className="ms-item-header" onClick={() => setOpen(v => !v)}>
        <span className="ms-item-date">{formatDate(record.submittedAt)}</span>
        <span className="ms-item-lang">{record.language.toUpperCase()}</span>
        <span className="ms-item-record">
          <span className="ms-win">{record.wins}승</span>
          {" "}
          <span className="ms-loss">{record.losses}패</span>
          {record.draws > 0 && <> <span className="ms-draw">{record.draws}무</span></>}
          <span className="ms-total"> / {total}전</span>
        </span>
        <button className="ms-expand-btn" aria-label="펼치기/접기">
          {open ? "▲" : "▼"}
        </button>
      </div>

      {open && (
        <div className="ms-item-body">
          {record.matches.length === 0 ? (
            <div className="ms-empty">매치 정보가 없습니다.</div>
          ) : (
            record.matches.map(m => (
              <MatchDetail key={m.matchId} match={m} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

const MySubmissionsTab: React.FC = () => {
  const [records, setRecords] = useState<SubmissionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await getMySubmissions(CONTEST_ID, p, PAGE_SIZE);
      setRecords(res.content);
      setTotalPages(res.totalPages);
      setPage(res.number);
    } catch (e: any) {
      setError(
        e.response?.data?.message ??
        e.message ??
        "제출 이력을 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPage(0); }, [fetchPage]);

  return (
    <div className="ms-container">
      <div className="ms-header-row">
        <h2 className="ms-title">내 제출 이력</h2>
        <button className="ms-refresh-btn" onClick={() => fetchPage(page)} disabled={loading}>
          {loading ? "..." : "↺ 새로고침"}
        </button>
      </div>

      {error && <div className="ms-error">{error}</div>}

      {!loading && !error && records.length === 0 && (
        <div className="ms-empty-state">아직 제출한 코드가 없습니다.</div>
      )}

      <div className="ms-list">
        {records.map(r => (
          <SubmissionItem key={r.submissionId} record={r} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="ms-pagination">
          <button
            className="ms-page-btn"
            disabled={page === 0 || loading}
            onClick={() => fetchPage(page - 1)}
          >
            ‹ 이전
          </button>
          <span className="ms-page-info">{page + 1} / {totalPages}</span>
          <button
            className="ms-page-btn"
            disabled={page >= totalPages - 1 || loading}
            onClick={() => fetchPage(page + 1)}
          >
            다음 ›
          </button>
        </div>
      )}
    </div>
  );
};

export default MySubmissionsTab;
