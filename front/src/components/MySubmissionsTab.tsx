import React, { useState, useEffect, useCallback } from "react";
import { LocalSubmission } from "../pages/BattleSubmitPage";
import { BattleMatchResult } from "../api/sseApi";
import { getMyBattleSubmissions, SubmissionSummaryResponse } from "../api/codeBattleApi";
import "./MySubmissionsTab.css";

interface Props {
  contestId: number;
  refreshKey: number;
  localSubmissions: LocalSubmission[];
  onLocalUpdate: React.Dispatch<React.SetStateAction<LocalSubmission[]>>;
  onLogClick: (log: string) => void;
  userId: string;
}

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

// ── 서버 응답을 LocalSubmission으로 변환 ──
function summaryToLocal(s: SubmissionSummaryResponse): LocalSubmission {
  return {
    submissionId: s.submissionId,
    submittedAt: new Date(s.submittedAt),
    language: s.language,
    success: true,
    message: "",
    wins: s.wins,
    losses: s.losses,
    matches: s.matches,
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
  const isMe = match.winner === userId;
  return (
    <tr className="ms-match-row">
      <td className="ms-match-num">#{index + 1}</td>
      <td>
        <span className={isMe ? "ms-winner--me" : "ms-winner--ai"}>{isMe ? "나" : "샘플 AI"}</span>
      </td>
      <td>
        <button
          className="ms-log-btn"
          onClick={() => onLogClick(match.log)}
          title="로그 분석 페이지에서 확인"
        >
          로그 보기 →
        </button>
      </td>
    </tr>
  );
}

// ── 제출 아이템 ──
function SubmissionItem({ sub, userId, onLogClick }: {
  sub: LocalSubmission;
  userId: string;
  onLogClick: (log: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // finalized면 서버 확정값 사용, 아니면 실시간 누적값 계산
  const wins   = sub.finalized && sub.wins   !== undefined ? sub.wins   : sub.matches.filter(m => m.winner === userId).length;
  const losses = sub.finalized && sub.losses !== undefined ? sub.losses : sub.matches.length - wins;
  const total  = sub.matches.length;

  return (
    <div className="ms-item">
      <div className="ms-item-header">
        <span className="ms-item-date">{formatDate(sub.submittedAt)}</span>
        <span className="ms-item-lang">{LANGUAGE_LABELS[sub.language] ?? sub.language.toUpperCase()}</span>

        <span className="ms-item-record">
          {total === 0 ? (
            <span className="ms-pending">채점 중...</span>
          ) : (
            <>
              <span className="ms-win">{wins}승</span>
              {" "}
              <span className="ms-loss">{losses}패</span>
              <span className="ms-total"> / {total}전</span>
              {!sub.finalized && <span className="ms-pending"> (채점 중)</span>}
            </>
          )}
        </span>

        <button
          className="ms-expand-btn"
          onClick={() => setExpanded(v => !v)}
          title="대전 상세 보기"
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
                <th>승자</th>
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFromServer = useCallback(async () => {
    console.log("[MySubmissionsTab] fetchFromServer called, contestId:", contestId);
    setLoading(true);
    setError(null);
    try {
      const data = await getMyBattleSubmissions(contestId, userId);
      console.log("[MySubmissionsTab] 응답:", data);
      onLocalUpdate(prev => {
        const inProgress = prev.filter(s => !s.finalized);
        const serverItems = data.map(summaryToLocal);
        const serverIds = new Set(serverItems.map(s => s.submissionId));
        const stillPending = inProgress.filter(s => !s.submissionId || !serverIds.has(s.submissionId));
        return [...stillPending, ...serverItems]
          .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
      });
    } catch (e: any) {
      console.error("[MySubmissionsTab] 에러:", e);
      setError(e.response?.data?.message ?? "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [contestId, refreshKey, onLocalUpdate]);

  // 탭 마운트 시 서버에서 이력 조회
  useEffect(() => {
    fetchFromServer();
  }, [fetchFromServer]);

  return (
    <div className="ms-container">
      <div className="ms-header-row">
        <h2 className="ms-title">내 제출 이력</h2>
        <button
          className="ms-refresh-btn"
          onClick={fetchFromServer}
          disabled={loading}
        >
          {loading ? "불러오는 중..." : "새로고침"}
        </button>
      </div>

      {error && <div className="ms-error">{error}</div>}

      {localSubmissions.length === 0 ? (
        <div className="ms-empty-state">
          {loading ? "불러오는 중..." : "아직 제출한 코드가 없습니다."}
        </div>
      ) : (
        <div className="ms-list">
          {localSubmissions.map((sub, i) => (
            <SubmissionItem key={sub.submissionId ?? i} sub={sub} userId={userId} onLogClick={onLogClick} />
          ))}
        </div>
      )}
    </div>
  );
};

export default MySubmissionsTab;
