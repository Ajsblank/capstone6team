import React, { useState, useEffect } from "react";
import {
  getSessionLeaderboard, getMiddleRanking, getContestSessions, getSwissMatchLog,
  SessionLeaderboard, LeaderboardStanding, MiddleRanking, MyMatchInfo,
} from "../api/codeBattleApi";
import "./LeaderboardTab.css";

interface Props {
  contestId: number;
  myUserId?: number;
  hasVisualization?: boolean;
  onLogView?: (log: string) => void;   // "로그 보러 가기" → viz1 탭 전달
}

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

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
  viewUserId: number;
  isMe: boolean;
  hasVisualization: boolean;
  data: MiddleRanking | null;
  loading: boolean;
  error: string | null;
  onLogView?: (log: string) => void;
}

const MatchDetailPanel: React.FC<DetailPanelProps> = ({
  contestId, viewUserId, isMe, hasVisualization, data, loading, error, onLogView,
}) => {
  const [logMap,       setLogMap]       = useState<Map<number, string>>(new Map());
  const [logLoadingId, setLogLoadingId] = useState<number | null>(null);
  const [logErrorId,   setLogErrorId]   = useState<number | null>(null);

  const handleLogCheck = (matchId: number) => {
    if (logMap.has(matchId) || logLoadingId === matchId) return;
    setLogLoadingId(matchId);
    setLogErrorId(null);
    getSwissMatchLog(contestId, matchId)
      .then(res => setLogMap(prev => new Map(prev).set(matchId, res.log)))
      .catch(() => setLogErrorId(matchId))
      .finally(() => setLogLoadingId(null));
  };

  if (loading) return <div className="lb-detail-panel"><span className="lb-detail-spinner" />불러오는 중...</div>;
  if (error)   return <div className="lb-detail-panel lb-detail-panel--error">{error}</div>;
  if (!data)   return null;

  return (
    <div className="lb-detail-panel">
      <div className="lb-detail-header">
        세션 {data.session_number} · {isMe ? "내" : `User ${viewUserId}의`} 매치 기록
      </div>
      <div className="lb-match-list">
        {data.my_matches.map(match => {
          const { label, cls } = getResultForUser(match, viewUserId);
          const opponent       = getOpponent(match, viewUserId);
          const log            = logMap.get(match.match_id);
          const isLogLoading   = logLoadingId === match.match_id;
          const isLogError     = logErrorId   === match.match_id;

          return (
            <div key={match.match_id} className="lb-match-item">
              <div className="lb-match-row">
                <span className="lb-match-round">{match.round_number}R</span>
                <span className="lb-match-opponent">
                  {opponent !== null ? `vs  User ${opponent}` : "부전승"}
                </span>
                <span className={`lb-match-result ${cls}`}>{label}</span>
                <div className="lb-match-actions">
                  <button
                    className={`lb-log-btn${isLogLoading ? " lb-log-btn--loading" : ""}${log ? " lb-log-btn--done" : ""}`}
                    disabled={isLogLoading}
                    onClick={() => handleLogCheck(match.match_id)}
                  >
                    {isLogLoading ? "로딩 중…" : log ? "로그 확인됨" : "로그 확인"}
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
              {log && (
                <pre className="lb-log-preview">{log}</pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

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
  const [middleCache,    setMiddleCache]    = useState<Map<number, MiddleRanking>>(new Map());
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
      .then(res => { if (!cancelled) setData(res); })
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
      .then(res => setMiddleCache(prev => new Map(prev).set(userId, res)))
      .catch(() => setDetailError("매치 정보를 불러오지 못했습니다."))
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
          <span className="lb-meta">{data.total_participants}명 · {data.total_rounds}라운드</span>
        )}
      </div>

      {loading && <div className="lb-empty">불러오는 중...</div>}
      {!loading && error && <div className="lb-empty lb-empty--error">{error}</div>}
      {!loading && !error && data && data.final_standings.length === 0 && (
        <div className="lb-empty">리더보드 정보가 없습니다.</div>
      )}

      {!loading && data && data.final_standings.length > 0 && (
        <div className="lb-list">
          {[...data.final_standings].sort((a, b) => a.rank - b.rank).map((s: LeaderboardStanding) => {
            const isMe       = myUserId !== undefined && s.user_id === myUserId;
            const isExpanded = expandedUserId === s.user_id;
            const rankClass  = s.rank <= 3 ? ` lb-card--rank${s.rank}` : "";
            const meClass    = isMe ? " lb-card--me" : "";

            return (
              <React.Fragment key={s.user_id}>
                <div
                  className={`lb-card${rankClass}${meClass} lb-card--expandable`}
                  onClick={() => handleCardClick(s.user_id)}
                >
                  <div className="lb-rank">
                    {RANK_MEDAL[s.rank]
                      ? <span className="lb-medal">{RANK_MEDAL[s.rank]}</span>
                      : <span className="lb-rank-num">{s.rank}</span>
                    }
                  </div>
                  <div className="lb-info">
                    <span className="lb-user-id">
                      User {s.user_id}
                      {isMe && <span className="lb-me-badge">나</span>}
                    </span>
                    <span className="lb-record">
                      <span className="lb-wins">{s.wins}승</span>
                      {s.draws  > 0 && <span className="lb-draws">{s.draws}무</span>}
                      {s.losses > 0 && <span className="lb-losses">{s.losses}패</span>}
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
                    viewUserId={s.user_id}
                    isMe={isMe}
                    hasVisualization={hasVisualization}
                    data={middleCache.get(s.user_id) ?? null}
                    loading={detailLoading && !middleCache.has(s.user_id)}
                    error={detailError}
                    onLogView={onLogView}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LeaderboardTab;
