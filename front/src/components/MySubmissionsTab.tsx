import React, { useState, useEffect, useCallback, useRef } from "react";
import { LocalSubmission } from "../pages/BattleSubmitPage";
import { BattleMatchResult, SseStatus, getSseStatus, setStatusCallback } from "../api/sseApi";
import { getMyBattleSubmissions, ContestSubmissionResponse } from "../api/codeBattleApi";
import "./MySubmissionsTab.css";

interface Props {
  contestId: number;
  refreshKey: number;
  localSubmissions: LocalSubmission[];
  onLocalUpdate: React.Dispatch<React.SetStateAction<LocalSubmission[]>>;
  onLogClick: (log: string) => void;
  userId: string;
}

type SortOrder = "newest" | "oldest";

const LANGUAGE_LABELS: Record<string, string> = {
  cpp: "C++", java: "Java", python: "Python",
  CPP: "C++", JAVA: "Java", PYTHON: "Python",
};

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function serverSubmissionToLocal(s: ContestSubmissionResponse, userId: string): LocalSubmission {
  const { status, log } = s.result;
  const winner = status === "WIN" ? userId : status === "DRAW" ? "draw" : "ai";
  const match: BattleMatchResult = { matchId: s.submissionId, winner, log };
  return {
    submissionId: s.submissionId,
    submittedAt: new Date(s.createdAt),
    language: "",
    success: true,
    message: "",
    wins:   status === "WIN"  ? 1 : 0,
    losses: status === "LOSE" ? 1 : 0,
    matches: [match],
    finalized: true,
  };
}

// ── 매치 상세 행 ──
function MatchRow({ match, index, userId, onLogClick }: {
  match: BattleMatchResult;
  index: number;
  userId: string;
  onLogClick: (log: string) => void;
}) {
  const isDraw = match.winner === "draw";
  const isMe   = !isDraw && match.winner === userId;
  return (
    <tr className="ms-match-row">
      <td className="ms-match-num">#{index + 1}</td>
      <td>
        <span className={isDraw ? "ms-winner--draw" : isMe ? "ms-winner--me" : "ms-winner--ai"}>
          {isDraw ? "무승부" : isMe ? "나" : "샘플 AI"}
        </span>
      </td>
      <td>
        <button className="ms-log-btn" onClick={() => onLogClick(match.log)}>
          로그 보기 →
        </button>
      </td>
    </tr>
  );
}

// ── 제출 아이템 ──
function SubmissionItem({ sub, seqNum, userId, onLogClick }: {
  sub: LocalSubmission;
  seqNum: number;
  userId: string;
  onLogClick: (log: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const wins   = sub.finalized && sub.wins   !== undefined ? sub.wins   : sub.matches.filter(m => m.winner === userId).length;
  const losses = sub.finalized && sub.losses !== undefined ? sub.losses : sub.matches.filter(m => m.winner !== userId && m.winner !== "draw").length;
  const total  = sub.matches.length;
  const draws  = total - wins - losses;

  const resultType = !sub.finalized ? "pending"
    : wins > losses ? "win"
    : losses > wins ? "loss"
    : "draw";

  return (
    <div className={`ms-item ms-item--${resultType}`}>
      <div
        className="ms-item-header"
        onClick={() => total > 0 && setExpanded(v => !v)}
        style={{ cursor: total > 0 ? "pointer" : "default" }}
      >
        <span className="ms-item-seq">#{seqNum}</span>
        <span className="ms-item-date">{formatDate(sub.submittedAt)}</span>
        {sub.language && (
          <span className="ms-item-lang">{LANGUAGE_LABELS[sub.language] ?? sub.language.toUpperCase()}</span>
        )}

        <span className="ms-item-record">
          {total === 0 ? (
            <span className="ms-pending">
              <span className="ms-spinner" aria-hidden="true" />
              채점 중...
            </span>
          ) : (
            <>
              {!sub.finalized && <span className="ms-spinner" aria-hidden="true" />}
              <span className="ms-win">{wins}승</span>
              {" "}
              {draws > 0 && <><span className="ms-draw">{draws}무</span>{" "}</>}
              <span className="ms-loss">{losses}패</span>
              <span className="ms-total"> / {total}전</span>
              {!sub.finalized && <span className="ms-pending"> (채점 중)</span>}
            </>
          )}
        </span>

        <span className={`ms-result-label ms-result-label--${resultType}`}>
          {resultType === "win" ? "승" : resultType === "loss" ? "패" : resultType === "draw" ? "무" : "…"}
        </span>

        <button
          className="ms-expand-btn"
          onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
          disabled={total === 0}
        >
          {expanded ? "▲" : "▼"}
        </button>
      </div>

      {expanded && total > 0 && (
        <div className="ms-item-body">
          <table className="ms-match-table">
            <thead>
              <tr>
                <th>매치</th>
                <th>결과</th>
                <th>로그</th>
              </tr>
            </thead>
            <tbody>
              {sub.matches.map((m, i) => (
                <MatchRow key={m.matchId} match={m} index={i} userId={userId} onLogClick={onLogClick} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── 탭 컴포넌트 ──
const MySubmissionsTab: React.FC<Props> = ({
  contestId, refreshKey, localSubmissions, onLocalUpdate, onLogClick, userId,
}) => {
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [sseStatus, setSseStatus]   = useState<SseStatus>(getSseStatus);
  const [sortOrder, setSortOrder]   = useState<SortOrder>("newest");

  useEffect(() => {
    setStatusCallback(setSseStatus);
    return () => setStatusCallback(null);
  }, []);

  const localSubmissionsRef = useRef(localSubmissions);
  useEffect(() => { localSubmissionsRef.current = localSubmissions; }, [localSubmissions]);

  const fetchFromServer = useCallback(async () => {
    console.log("[MySubmissionsTab] fetchFromServer — contestId:", contestId, "userId:", userId, "refreshKey:", refreshKey);
    setLoading(true);
    setError(null);
    try {
      const data = await getMyBattleSubmissions(contestId, userId);
      console.log("[MySubmissionsTab] 서버 응답:", data.length, "건", data);
      onLocalUpdate(prev => {
        const inProgress = prev.filter(s => !s.finalized);

        // 서버 항목을 최신순 정렬
        const serverItems = data
          .map(s => serverSubmissionToLocal(s, userId))
          .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());

        // submissionId가 없는(SSE 미완료) in-progress 항목 수만큼
        // 서버 응답의 최신 항목을 스킵 → 타임존과 무관한 중복 제거
        const pendingCount = inProgress.filter(s => s.submissionId == null).length;
        const serverToShow = serverItems.slice(pendingCount);

        // SSE로 이미 ID를 받은 in-progress 항목도 서버 항목과 중복 제거
        const inProgressIds = new Set(inProgress.map(s => s.submissionId).filter(Boolean));
        const filtered = serverToShow.filter(s => !s.submissionId || !inProgressIds.has(s.submissionId));

        console.log(
          "[MySubmissionsTab] 병합 — inProgress:", inProgress.length,
          "/ pendingCount:", pendingCount,
          "/ server:", serverItems.length,
          "/ serverToShow:", serverToShow.length,
          "/ filtered:", filtered.length,
        );
        return [...inProgress, ...filtered]
          .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
      });
    } catch (e: any) {
      console.error("[MySubmissionsTab] 서버 조회 오류:", e);
      setError(e.response?.data?.message ?? "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [contestId, refreshKey, onLocalUpdate, userId]);

  useEffect(() => {
    fetchFromServer();
  }, [fetchFromServer]);

  // 정렬 적용 (내부 정렬 — localSubmissions 자체는 항상 최신순 유지)
  const sorted = [...localSubmissions].sort((a, b) =>
    sortOrder === "newest"
      ? b.submittedAt.getTime() - a.submittedAt.getTime()
      : a.submittedAt.getTime() - b.submittedAt.getTime()
  );
  const total = sorted.length;

  return (
    <div className="ms-container">
      <div className="ms-header-row">
        <h2 className="ms-title">내 제출 이력</h2>
        <span className={`ms-sse-badge ms-sse-badge--${sseStatus}`}>
          {sseStatus === "connected" ? "● SSE 연결됨" : sseStatus === "connecting" ? "◌ SSE 연결 중" : "○ SSE 끊김"}
        </span>
        <div className="ms-sort-group">
          <button
            className={`ms-sort-btn${sortOrder === "newest" ? " ms-sort-btn--active" : ""}`}
            onClick={() => setSortOrder("newest")}
          >
            최신순
          </button>
          <button
            className={`ms-sort-btn${sortOrder === "oldest" ? " ms-sort-btn--active" : ""}`}
            onClick={() => setSortOrder("oldest")}
          >
            오래된 순
          </button>
        </div>
        <button className="ms-refresh-btn" onClick={fetchFromServer} disabled={loading}>
          {loading ? "불러오는 중..." : "새로고침"}
        </button>
      </div>

      {error && <div className="ms-error">{error}</div>}

      {sorted.length === 0 ? (
        <div className="ms-empty-state">
          {loading ? "불러오는 중..." : "아직 제출한 코드가 없습니다."}
        </div>
      ) : (
        <div className="ms-list">
          {sorted.map((sub, i) => {
            // 제출 번호: 오래된 것부터 #1. 최신순 표시 시 n-i, 오래된 순 시 i+1
            const seqNum = sortOrder === "newest" ? total - i : i + 1;
            return (
              <SubmissionItem
                key={sub.submissionId ?? sub.submittedAt.toISOString()}
                sub={sub}
                seqNum={seqNum}
                userId={userId}
                onLogClick={onLogClick}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MySubmissionsTab;
