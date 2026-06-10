import React, { useState, useEffect, useCallback } from "react";
import { getContestSessions, ContestSession, scheduleSwissLeague } from "../api/codeBattleApi";
import "./BattleSessionsTab.css";

interface Props {
  contestId: number;
  onSessionClick: (sessionNumber: number) => void;
  isHostOrReviewer?: boolean;
}

function parseDate(s: string): Date {
  if (!s) return new Date(NaN);
  return new Date(s);
}

function formatDate(s: string): string {
  const d = parseDate(s);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// datetime-local 값(로컬 시간) → LocalDateTime 호환 문자열 (타임존 없음)
// 백엔드가 List<LocalDateTime>으로 받으므로 UTC 변환하지 않고 그대로 전송
function localToDateTime(localVal: string): string {
  if (!localVal) return "";
  return localVal.length === 16 ? `${localVal}:00` : localVal;
}

const STATUS_LABEL: Record<string, string> = {
  RUNNING: "진행 중",
  END:     "종료",
  PLANNED: "대기 중",
  PAUSED:  "일시 정지",
};

const BattleSessionsTab: React.FC<Props> = ({ contestId, onSessionClick, isHostOrReviewer }) => {
  const [sessions, setSessions] = useState<ContestSession[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [showPanel, setShowPanel]     = useState(false);
  const [dateInputs, setDateInputs]   = useState<string[]>([""]);
  const [submitting, setSubmitting]   = useState(false);
  const [feedback, setFeedback]       = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const fetchSessions = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getContestSessions(contestId)
      .then(data => { if (!cancelled) setSessions(data); })
      .catch(() => { if (!cancelled) setError("세션 목록을 불러오지 못했습니다."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [contestId]);

  useEffect(() => {
    const cancel = fetchSessions();
    return cancel;
  }, [fetchSessions]);

  const openPanel = () => {
    setDateInputs([""]);
    setFeedback(null);
    setShowPanel(true);
  };

  const closePanel = () => {
    setShowPanel(false);
    setFeedback(null);
  };

  const updateDate = (idx: number, val: string) => {
    setDateInputs(prev => prev.map((d, i) => i === idx ? val : d));
  };

  const addDate = () => setDateInputs(prev => [...prev, ""]);

  const removeDate = (idx: number) => {
    setDateInputs(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    let isoList: string[] = [];
    try {
      isoList = dateInputs.map(localToDateTime).filter(Boolean);
    } catch {
      setFeedback({ type: "error", msg: "날짜 형식이 올바르지 않습니다." });
      return;
    }

    if (isoList.length === 0) {
      setFeedback({ type: "error", msg: "날짜를 하나 이상 입력해주세요." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      await scheduleSwissLeague(contestId, isoList);
      setFeedback({ type: "success", msg: `${isoList.length}개 세션이 예약되었습니다.` });
      const prevCount = sessions.length;
      let attempts = 0;
      const poll = () => {
        attempts++;
        getContestSessions(contestId).then(data => {
          if ((data?.length ?? 0) > prevCount || attempts >= 10) {
            setSessions(data ?? []);
            setShowPanel(false);
            setFeedback(null);
          } else {
            setTimeout(poll, 1000);
          }
        }).catch(() => {
          if (attempts < 10) setTimeout(poll, 1000);
        });
      };
      setTimeout(poll, 1000);
    } catch (e: any) {
      const status = e?.response?.status;
      const serverMsg = e?.response?.data?.message ?? e?.response?.data ?? "";
      setFeedback({
        type: "error",
        msg: `예약 실패${status ? ` (${status})` : ""}${serverMsg ? `: ${serverMsg}` : ". 다시 시도해주세요."}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = dateInputs.some(d => d.trim() !== "") && !submitting;

  return (
    <div className="bst-container">
      {/* ── 헤더 ── */}
      <div className="bst-header">
        <h2 className="bst-title">대결 세션</h2>
        {sessions.length > 0 && <span className="bst-count">총 {sessions.length}세션</span>}
        {isHostOrReviewer && (
          <button
            className={`bst-schedule-btn${showPanel ? " bst-schedule-btn--active" : ""}`}
            onClick={showPanel ? closePanel : openPanel}
          >
            {showPanel ? "취소" : "+ 세션 예약"}
          </button>
        )}
      </div>

      {/* ── 예약 패널 ── */}
      {showPanel && isHostOrReviewer && (
        <div className="bst-schedule-panel">
          <div className="bst-schedule-panel-title">세션 예약 시간 설정</div>

          {feedback && (
            <div className={`bst-schedule-feedback bst-schedule-feedback--${feedback.type}`}>
              {feedback.msg}
            </div>
          )}

          <div className="bst-date-list">
            {dateInputs.map((val, idx) => (
              <div key={idx} className="bst-date-row">
                <span className="bst-date-num">{idx + 1}</span>
                <input
                  type="datetime-local"
                  className="bst-date-input"
                  value={val}
                  onChange={e => updateDate(idx, e.target.value)}
                />
                <button
                  className="bst-date-remove"
                  onClick={() => removeDate(idx)}
                  disabled={dateInputs.length === 1}
                  title="제거"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="bst-schedule-actions">
            <button className="bst-date-add" onClick={addDate}>+ 시간 추가</button>
            <button className="bst-schedule-cancel" onClick={closePanel}>취소</button>
            <button
              className="bst-schedule-submit"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? "예약 중..." : "예약"}
            </button>
          </div>
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
