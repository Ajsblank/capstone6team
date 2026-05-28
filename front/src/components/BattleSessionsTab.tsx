import React, { useState, useEffect } from "react";
import { getContestSessions, ContestSession } from "../api/codeBattleApi";
import "./BattleSessionsTab.css";

interface Props {
  contestId: number;
  onSessionClick: (sessionNumber: number) => void;
}

function parseDate(s: string): Date {
  if (!s) return new Date(NaN);
  if (s.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(s)) return new Date(s);
  return new Date(s + "Z");
}

function formatDate(s: string): string {
  const d = parseDate(s);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_LABEL: Record<string, string> = {
  RUNNING: "진행 중",
  END:     "종료",
  PLANNED: "대기 중",
  PAUSED:  "일시 정지",
};

const BattleSessionsTab: React.FC<Props> = ({ contestId, onSessionClick }) => {
  const [sessions, setSessions] = useState<ContestSession[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getContestSessions(contestId)
      .then(data => { if (!cancelled) setSessions(data); })
      .catch(() => { if (!cancelled) setError("세션 목록을 불러오지 못했습니다."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [contestId]);

  if (loading) return <div className="bst-empty">불러오는 중...</div>;
  if (error)   return <div className="bst-empty bst-empty--error">{error}</div>;
  if (sessions.length === 0) return <div className="bst-empty">예정된 세션이 없습니다.</div>;

  return (
    <div className="bst-container">
      <div className="bst-header">
        <h2 className="bst-title">대결 세션</h2>
        <span className="bst-count">총 {sessions.length}세션</span>
      </div>

      <div className="bst-cards">
        {sessions.map(session => {
          const isRunning = session.status === "RUNNING";
          const isEnded   = session.status === "END";
          const isLocked  = !isRunning && !isEnded;
          return (
            <div
              key={session.sessionNumber}
              className={`bst-card${isRunning ? " bst-card--running" : isEnded ? " bst-card--ended" : ""}`}
              onClick={!isLocked ? () => onSessionClick(session.sessionNumber) : undefined}
              title={!isLocked ? "클릭해서 세션 보기" : undefined}
            >
              {/* 카드 본문 — 잠금 시 블러 */}
              <div className={`bst-card-body${isLocked ? " bst-card-body--blurred" : ""}`}>
                <div className={`bst-num-area${isRunning ? " bst-num-area--running" : ""}`}>
                  <span className="bst-round-label">SESSION</span>
                  <span className={`bst-round-num${isRunning ? " bst-round-num--running" : ""}`}>
                    {String(session.sessionNumber).padStart(2, "0")}
                  </span>
                </div>
                {isRunning && (
                  <span className="bst-badge bst-badge--running">● {STATUS_LABEL["RUNNING"]}</span>
                )}
                {isEnded && (
                  <span className="bst-badge bst-badge--ended">{STATUS_LABEL["END"]}</span>
                )}
              </div>

              {/* 잠금 오버레이 */}
              {isLocked && (
                <div className="bst-lock-overlay">
                  <span className="bst-lock-icon">🔒</span>
                  {session.scheduledAt ? (
                    <span className="bst-lock-text">
                      {formatDate(session.scheduledAt)}<br />시작 예정
                    </span>
                  ) : (
                    <span className="bst-lock-text">
                      {STATUS_LABEL[session.status] ?? session.status}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BattleSessionsTab;
