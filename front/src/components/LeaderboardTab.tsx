import React, { useState, useEffect } from "react";
import {
  getSessionLeaderboard, getMiddleRanking, getContestSessions, getSwissMatchLog,
  SessionLeaderboard, MyMatchInfo,
} from "../api/codeBattleApi";
import "./LeaderboardTab.css";

interface Props {
  contestId: number;
  myUserId?: number;
  hasVisualization?: boolean;
  onLogView?: (log: string) => void;   // "로그 보러 가기" → viz1 탭 전달
}

function renderNickTag(value: string): React.ReactNode {
  const i = value.lastIndexOf('-');
  if (i === -1) return value;
  return <>{value.slice(0, i)}<span className="lb-nick-tag">#{value.slice(i + 1)}</span></>;
}

function getResultForUser(match: MyMatchInfo, userId: number): { label: string; cls: string } {
  if (match.result === "BYE")   return { label: "부전승", cls: "lb-result--bye" };
  if (match.winner === null)    return { label: "진행 중", cls: "lb-result--pending" };
  if (match.winner === 0)       return { label: "무승부",  cls: "lb-result--draw" };
  const won = (match.winner === 1 && match.user1_id === userId) ||
              (match.winner === 2 && match.user2_id === userId);
  return won ? { label: "승", cls: "lb-result--win" } : { label: "패", cls: "lb-result--lose" };
}

function getOpponent(match: MyMatchInfo, userId: number): number | null {
  if (match.result === "BYE") return null;
  return match.user1_id === userId ? match.user2_id : match.user1_id;
}

// ── 매치 상세 패널 ─────────────────────────────────────────────────────────────

interface DetailPanelProps {
  contestId: number;
  sessionNumber: number | null;
  viewUserId: number;
  viewNick: string;
  isMe: boolean;
  hasVisualization: boolean;
  matches: MyMatchInfo[] | null;
  loading: boolean;
  error: string | null;
  onLogView?: (log: string) => void;
  nickMap: Map<number, string>;
}

const MatchDetailPanel: React.FC<DetailPanelProps> = ({
  contestId, sessionNumber, viewUserId, viewNick, isMe, hasVisualization, matches, loading, error, onLogView, nickMap,
}) => {
  const [logMap,        setLogMap]        = useState<Map<number, string>>(new Map());
  const [logLoadingId,  setLogLoadingId]  = useState<number | null>(null);
  const [logErrorId,    setLogErrorId]    = useState<number | null>(null);
  const [openLogId,     setOpenLogId]     = useState<number | null>(null);

  const handleLogCheck = (matchId: number) => {
    // 이미 로드된 경우 토글만
    if (logMap.has(matchId)) {
      setOpenLogId(prev => prev === matchId ? null : matchId);
      return;
    }
    if (logLoadingId === matchId) return;
    setLogLoadingId(matchId);
    setLogErrorId(null);
    getSwissMatchLog(contestId, matchId)
      .then(res => {
        const raw: any = res;
        const display: string =
          typeof raw === "string" ? raw :
          (typeof raw?.log === "string" ? raw.log : JSON.stringify(raw, null, 2));
        setLogMap(prev => new Map(prev).set(matchId, display));
        setOpenLogId(matchId);
      })
      .catch(() => {
        setLogErrorId(matchId);
      })
      .finally(() => setLogLoadingId(null));
  };

  if (loading) return <div className="lb-detail-panel"><span className="lb-detail-spinner" />불러오는 중...</div>;
  if (error)   return <div className="lb-detail-panel lb-detail-panel--error">{error}</div>;
  if (!matches) return null;

  return (
    <div className="lb-detail-panel">
      <div className="lb-detail-header">
        세션 {sessionNumber} · {isMe ? "내" : `${viewNick}의`} 매치 기록
      </div>
      <div className="lb-match-list">
        {matches.map(match => {
          const { label, cls } = getResultForUser(match, viewUserId);
          const opponent       = getOpponent(match, viewUserId);
          const log          = logMap.get(match.match_id);
          const isLogLoading = logLoadingId === match.match_id;
          const isLogError   = logErrorId   === match.match_id;
          const isLogOpen    = openLogId    === match.match_id;

          return (
            <div key={match.match_id} className="lb-match-item">
              <div className="lb-match-row">
                <span className="lb-match-round">{match.round_number}R</span>
                <span className="lb-match-opponent">
                  {opponent !== null
                    ? <>vs {renderNickTag(nickMap.get(opponent) ?? `User ${opponent}`)}</>
                    : "부전승"}
                </span>
                <span className={`lb-match-result ${cls}`}>{label}</span>
                <div className="lb-match-actions">
                  <button
                    className={`lb-log-btn${isLogLoading ? " lb-log-btn--loading" : ""}${log ? " lb-log-btn--active" : ""}`}
                    disabled={isLogLoading}
                    onClick={() => handleLogCheck(match.match_id)}
                  >
                    {isLogLoading ? "로딩 중…" : log ? (isLogOpen ? "로그 닫기 ▲" : "로그 열기 ▼") : "로그 확인"}
                  </button>
                  {hasVisualization && onLogView && log && (
                    <button className="lb-viz-btn" onClick={() => onLogView(log)}>
                      로그 보러 가기
                    </button>
                  )}
                </div>
              </div>

              {isLogError && (
                <div className="lb-log-error">로그를 불러오지 못했습니다.</div>
              )}
              {isLogOpen && (
                log
                  ? <pre className="lb-log-preview">{log}</pre>
                  : <div className="lb-log-error">로그 내용이 없습니다.</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── 공동 순위 계산 (같은 승점 → 같은 등수, 다음 등수는 건너뜀) ────────────────────
// 모든 행에 등수를 부여하되 동점이면 같은 숫자(예: 1,1,1,4)
function computeTiedRanks<T extends { points: number }>(entries: T[]): (T & { displayRank: number })[] {
  const sorted = [...entries].sort((a, b) => b.points - a.points);
  let lastRank = 0;
  let lastPoints: number | null = null;
  return sorted.map((entry, idx) => {
    if (lastPoints === null || entry.points !== lastPoints) {
      lastRank = idx + 1;        // 새 승점 그룹 → 현재 인덱스 기준 등수
      lastPoints = entry.points;
    }
    return { ...entry, displayRank: lastRank };
  });
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

const LeaderboardTab: React.FC<Props> = ({
  contestId, myUserId, hasVisualization = false, onLogView,
}) => {
  const [availableSessions, setAvailableSessions] = useState<number[]>([]);
  const [selectedSession,   setSelectedSession]   = useState<number | null>(null);

  const [data,    setData]    = useState<SessionLeaderboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [middleCache,    setMiddleCache]    = useState<Map<number, MyMatchInfo[]>>(new Map());
  const [detailLoading,  setDetailLoading]  = useState(false);
  const [detailError,    setDetailError]    = useState<string | null>(null);

  // 1단계: END 세션 목록 조회
  useEffect(() => {
    let cancelled = false;
    getContestSessions(contestId)
      .then(sessions => {
        if (cancelled) return;
        const ended = sessions
          .filter(s => s.status === "END")
          .map(s => s.sessionNumber)
          .sort((a, b) => a - b);
        setAvailableSessions(ended);
        if (ended.length > 0) setSelectedSession(ended[ended.length - 1]);
        else setError("종료된 세션이 없습니다.");
      })
      .catch(() => { if (!cancelled) setError("세션 정보를 불러오지 못했습니다."); });
    return () => { cancelled = true; };
  }, [contestId]);

  // 2단계: 선택 세션 변경 시 리더보드 재조회
  useEffect(() => {
    if (selectedSession === null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    setExpandedUserId(null);
    setMiddleCache(new Map());
    setDetailError(null);
    getSessionLeaderboard(contestId, selectedSession)
      .then(res => {
        if (cancelled) return;
        setData(res);
      })
      .catch(() => { if (!cancelled) setError("리더보드를 불러오지 못했습니다."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [contestId, selectedSession]);

  const handleCardClick = (userId: number) => {
    if (expandedUserId === userId) { setExpandedUserId(null); return; }
    setExpandedUserId(userId);
    setDetailError(null);
    if (middleCache.has(userId) || detailLoading || selectedSession === null) return;
    setDetailLoading(true);
    getMiddleRanking(contestId, selectedSession, userId)
      .then(res => {
        setMiddleCache(prev => new Map(prev).set(userId, res));
      })
      .catch(() => {
        setDetailError("매치 정보를 불러오지 못했습니다.");
      })
      .finally(() => setDetailLoading(false));
  };

  // ── 세션 네비게이션 ──────────────────────────────────────────────────────────
  const currentIdx = selectedSession !== null ? availableSessions.indexOf(selectedSession) : -1;
  const canPrev    = currentIdx > 0;
  const canNext    = currentIdx < availableSessions.length - 1;

  if (error && availableSessions.length === 0)
    return <div className="lb-empty lb-empty--error">{error}</div>;

  return (
    <div className="lb-container">
      <div className="lb-header">
        <h2 className="lb-title">리더보드</h2>
        <div className="lb-session-nav">
          <button className="lb-nav-btn" disabled={!canPrev}
            onClick={() => setSelectedSession(availableSessions[currentIdx - 1])}>◀</button>
          <span className="lb-nav-label">세션 {selectedSession ?? "-"}</span>
          <button className="lb-nav-btn" disabled={!canNext}
            onClick={() => setSelectedSession(availableSessions[currentIdx + 1])}>▶</button>
        </div>
        {data && (
          <span className="lb-meta">
            <span className="lb-meta-participants">{data.total_participants}<em>명</em></span>
            <span className="lb-meta-sep">·</span>
            <span className="lb-meta-rounds">{data.total_rounds}<em>라운드</em></span>
          </span>
        )}
      </div>

      {loading && <div className="lb-empty">불러오는 중...</div>}
      {!loading && error && <div className="lb-empty lb-empty--error">{error}</div>}
      {!loading && !error && data && data.final_standings.length === 0 && (
        <div className="lb-empty">리더보드 정보가 없습니다.</div>
      )}

      {!loading && data && data.final_standings.length > 0 && (
        <div className="lb-list">
          {(() => {
            const nickMap = new Map(data.final_standings.map(s => [s.user_id, s.nickname_tag ?? `User ${s.user_id}`]));
            return computeTiedRanks(data.final_standings).map((s) => {
            const isMe       = myUserId !== undefined && s.user_id === myUserId;
            const isExpanded = expandedUserId === s.user_id;
            const rankClass  = s.displayRank <= 3 ? ` lb-card--rank${s.displayRank}` : "";
            const displayName = s.nickname_tag ?? `User ${s.user_id}`;

            return (
              <React.Fragment key={s.user_id}>
                <div
                  className={`lb-card${rankClass} lb-card--expandable`}
                  onClick={() => handleCardClick(s.user_id)}
                >
                  <div className="lb-rank">
                    <span className="lb-rank-num">{s.displayRank}</span>
                  </div>
                  <div className="lb-info">
                    <span className="lb-user-id">
                      {renderNickTag(displayName)}
                      {isMe && <span className="lb-me-badge">나</span>}
                    </span>
                    <span className="lb-record">
                      <span className="lb-wins">{s.wins}승</span>
                      <span className="lb-draws">{s.draws}무</span>
                      <span className="lb-losses">{s.losses}패</span>
                      <span className="lb-total">· {data.total_rounds}전</span>
                    </span>
                  </div>
                  <div className="lb-points">
                    <span className="lb-points-num">{s.points}</span>
                    <span className="lb-points-label">승점</span>
                  </div>
                  <span className="lb-expand-arrow">{isExpanded ? "▲" : "▼"}</span>
                </div>

                {isExpanded && (
                  <MatchDetailPanel
                    contestId={contestId}
                    sessionNumber={selectedSession}
                    viewUserId={s.user_id}
                    viewNick={displayName}
                    isMe={isMe}
                    hasVisualization={hasVisualization}
                    matches={middleCache.get(s.user_id) ?? null}
                    loading={detailLoading && !middleCache.has(s.user_id)}
                    error={detailError}
                    onLogView={onLogView}
                    nickMap={nickMap}
                  />
                )}
              </React.Fragment>
            );
          });
          })()}
        </div>
      )}
    </div>
  );
};

export default LeaderboardTab;
