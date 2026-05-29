import React, { useState, useEffect } from "react";
import { getContestSessions, scheduleSwissLeague, ContestSession } from "../api/codeBattleApi";
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

function nowLocalIso(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
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

  // ── 세션 예약 테스트 ─────────────────────────────────────────────────────────
  const [scheduleOpen,    setScheduleOpen]    = useState(false);
  const [dateList,        setDateList]        = useState<string[]>([nowLocalIso()]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleResult,  setScheduleResult]  = useState<"success" | "error" | null>(null);

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

  const addDate    = () => setDateList(prev => [...prev, nowLocalIso()]);
  const removeDate = (i: number) => setDateList(prev => prev.filter((_, idx) => idx !== i));
  const updateDate = (i: number, val: string) =>
    setDateList(prev => prev.map((d, idx) => idx === i ? val : d));

  const handleScheduleSubmit = async () => {
    if (dateList.length === 0 || scheduleLoading) return;
    setScheduleLoading(true);
    setScheduleResult(null);
    try {
      const isoList = dateList
        .filter(d => d.trim())
        .map(d => new Date(d).toISOString());
      console.log("[BattleSessionsTab] scheduleSwissLeague →", isoList);
      await scheduleSwissLeague(contestId, isoList);
      setScheduleResult("success");
      setScheduleOpen(false);
      setDateList([nowLocalIso()]);
    } catch (err: any) {
      console.error("[BattleSessionsTab] scheduleSwissLeague 오류", err?.response ?? err);
      setScheduleResult("error");
    } finally {
      setScheduleLoading(false);
    }
  };

  return (
    <div className="bst-container">
      {/* ── 헤더 ── */}
      <div className="bst-header">
        <h2 className="bst-title">대결 세션</h2>
        {sessions.length > 0 && <span className="bst-count">총 {sessions.length}세션</span>}
        <button
          className={`bst-schedule-btn${scheduleOpen ? " bst-schedule-btn--active" : ""}`}
          onClick={() => { setScheduleOpen(o => !o); setScheduleResult(null); }}
        >
          ⚗ 세션 예약
        </button>
      </div>

      {/* ── 예약 패널 ── */}
      {scheduleOpen && (
        <div className="bst-schedule-panel">
          <div className="bst-schedule-panel-title">
            스위스 세션 예약 · {dateList.length}개
          </div>

          <div className="bst-date-list">
            {dateList.map((d, i) => (
              <div key={i} className="bst-date-row">
                <span className="bst-date-num">{i + 1}</span>
                <input
                  type="datetime-local"
                  className="bst-date-input"
                  value={d}
                  onChange={e => updateDate(i, e.target.value)}
                />
                <button
                  className="bst-date-remove"
                  onClick={() => removeDate(i)}
                  disabled={dateList.length === 1}
                >✕</button>
              </div>
            ))}
          </div>

          <div className="bst-schedule-actions">
            <button className="bst-date-add" onClick={addDate}>+ 날짜 추가</button>
            <div style={{ flex: 1 }} />
            <button
              className="bst-schedule-cancel"
              onClick={() => setScheduleOpen(false)}
            >취소</button>
            <button
              className="bst-schedule-submit"
              disabled={scheduleLoading || dateList.every(d => !d.trim())}
              onClick={handleScheduleSubmit}
            >
              {scheduleLoading ? "요청 중…" : "생성 요청"}
            </button>
          </div>

          {scheduleResult === "error" && (
            <div className="bst-schedule-feedback bst-schedule-feedback--error">
              요청에 실패했습니다.
            </div>
          )}
        </div>
      )}

      {scheduleResult === "success" && (
        <div className="bst-schedule-feedback bst-schedule-feedback--success">
          세션 예약이 완료됐습니다.
        </div>
      )}

      {/* ── 세션 목록 ── */}
      {loading && <div className="bst-empty">불러오는 중...</div>}
      {!loading && error && <div className="bst-empty bst-empty--error">{error}</div>}
      {!loading && !error && sessions.length === 0 && (
        <div className="bst-empty">예정된 세션이 없습니다.</div>
      )}
      {!loading && sessions.length > 0 && (
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
      )}
    </div>
  );
};

export default BattleSessionsTab;
