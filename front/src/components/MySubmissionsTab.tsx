import React, { useState, useEffect, useCallback, useRef } from "react";
import { LocalSubmission } from "../pages/BattleSubmitPage";
import { BattleMatchResult, SseStatus, getSseStatus, setStatusCallback, debugSse } from "../api/sseApi";
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

// 동일 submissionId를 가진 항목 그룹을 하나의 LocalSubmission으로 변환
function serverGroupToLocal(group: ContestSubmissionResponse[], userId: string): LocalSubmission {
  // 가장 오래된 항목의 시간을 제출 시간으로 사용
  const sorted = [...group].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const first = sorted[0];

  const matchMap = new Map<number, BattleMatchResult>();
  for (const item of group) {
    const { aiId, status, log } = item.result;
    if (!log || !log.trim()) continue;
    if (matchMap.has(aiId)) continue; // 같은 aiId 중복 제거
    const winner = status === "WIN" ? userId : status === "DRAW" ? "draw" : "ai";
    matchMap.set(aiId, { matchId: aiId, winner, log });
  }
  const matches: BattleMatchResult[] = Array.from(matchMap.values());

  const uniqueAiCount = new Set(group.map(item => item.result.aiId)).size;
  const allComplete = matchMap.size === uniqueAiCount && uniqueAiCount > 0;
  const wins   = matches.filter(m => m.winner === userId).length;
  const losses = matches.filter(m => m.winner !== userId && m.winner !== "draw").length;

  return {
    submissionId: first.submissionId,
    submittedAt:  new Date(first.createdAt),
    language: "",
    success:  true,
    message:  "",
    wins:    allComplete ? wins   : undefined,
    losses:  allComplete ? losses : undefined,
    matches,
    finalized: allComplete,
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

  const resultType = sub.error ? "error"
    : total === 0 ? "pending"
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
          {sub.error ? (
            <span className="ms-error-inline">채점 중 오류 발생</span>
          ) : total === 0 ? (
            <span className="ms-pending">
              <span className="ms-spinner" aria-hidden="true" />
              채점 중...
            </span>
          ) : (
            <>
              <span className="ms-win">{wins}승</span>
              {" "}
              {draws > 0 && <><span className="ms-draw">{draws}무</span>{" "}</>}
              <span className="ms-loss">{losses}패</span>
              <span className="ms-total"> / {total}전</span>
            </>
          )}
        </span>

        <span className={`ms-result-label ms-result-label--${resultType}`}>
          {resultType === "win" ? "승" : resultType === "loss" ? "패" : resultType === "draw" ? "무" : resultType === "error" ? "오류" : "…"}
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
                <MatchRow key={`${m.matchId}-${i}`} match={m} index={i} userId={userId} onLogClick={onLogClick} />
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

  // SSE가 재연결 한도 초과로 끊기면 채점 중인 제출을 오류 상태로 전환
  const prevSseStatusRef = useRef<SseStatus>(getSseStatus());
  useEffect(() => {
    if (prevSseStatusRef.current !== "disconnected" && sseStatus === "disconnected") {
      onLocalUpdate(prev =>
        prev.map(s =>
          s.finalized || s.error
            ? s
            : { ...s, error: "SSE 연결 오류로 채점 결과를 받지 못했습니다." }
        )
      );
    }
    prevSseStatusRef.current = sseStatus;
  }, [sseStatus, onLocalUpdate]);

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
        // 서버 항목을 submissionId로 그룹화 → 각 그룹을 하나의 LocalSubmission으로 변환
        const grouped = new Map<number, ContestSubmissionResponse[]>();
        for (const item of data) {
          const id = item.submissionId;
          if (!grouped.has(id)) grouped.set(id, []);
          grouped.get(id)!.push(item);
        }
        const serverItems = Array.from(grouped.values())
          .map(group => serverGroupToLocal(group, userId))
          .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());

        const inProgress  = prev.filter(s => !s.finalized);
        const withId      = inProgress.filter(s => s.submissionId != null);
        const withoutId   = inProgress.filter(s => s.submissionId == null);

        // SSE 단절로 submissionId를 받지 못한 로컬 대기 항목을
        // 서버 확정 결과로 교체 (제출 시각 2분 이내 항목을 동일 제출로 간주)
        const MATCH_MS = 120_000;
        const usedServerIds = new Set<number>();
        const resolvedPending: LocalSubmission[] = withoutId.map(local => {
          const match = serverItems.find(s =>
            s.submissionId != null &&
            s.finalized &&
            Math.abs(s.submittedAt.getTime() - local.submittedAt.getTime()) < MATCH_MS
          );
          if (match?.submissionId != null) {
            usedServerIds.add(match.submissionId);
            return match;
          }
          return local;
        });

        // SSE로 이미 ID를 받은 in-progress 항목 및 교체된 서버 항목 중복 제거
        const withIdIds = new Set(withId.map(s => s.submissionId).filter(Boolean));
        const serverExtra = serverItems.filter(s =>
          s.submissionId != null &&
          !withIdIds.has(s.submissionId) &&
          !usedServerIds.has(s.submissionId)
        );

        console.log(
          "[MySubmissionsTab] 병합 — withId:", withId.length,
          "/ withoutId:", withoutId.length,
          "/ resolved:", resolvedPending.filter(s => s.submissionId != null).length,
          "/ serverExtra:", serverExtra.length,
        );
        return [...resolvedPending, ...withId, ...serverExtra]
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
        <span
          className={`ms-sse-badge ms-sse-badge--${sseStatus}`}
          title="클릭 시 SSE 상태를 콘솔에 출력"
          onClick={debugSse}
          style={{ cursor: "pointer" }}
        >
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
