import React, { useState, useEffect } from "react";
import {
  getSessionLeaderboard, getMiddleRanking, getContestSessions, getSwissMatchLog,
  SessionLeaderboard, LeaderboardStanding, MyMatchInfo,
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
  sessionNumber: number | null;
  viewUserId: number;
  isMe: boolean;
  hasVisualization: boolean;
  matches: MyMatchInfo[] | null;
  loading: boolean;
  error: string | null;
  onLogView?: (log: string) => void;
}

const MatchDetailPanel: React.FC<DetailPanelProps> = ({
  contestId, sessionNumber, viewUserId, isMe, hasVisualization, matches, loading, error, onLogView,
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
        console.group(`[LeaderboardTab] matchLog — contest=${contestId} match=${matchId}`);
        console.log("raw response :", raw);
        console.log("typeof       :", typeof raw);
        console.groupEnd();
        const display: string =
          typeof raw === "string" ? raw :
          (typeof raw?.log === "string" ? raw.log : JSON.stringify(raw, null, 2));
        setLogMap(prev => new Map(prev).set(matchId, display));
        setOpenLogId(matchId);
      })
      .catch(err => {
        console.error(`[LeaderboardTab] matchLog 오류 — contest=${contestId} match=${matchId}`, err?.response ?? err);
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
        세션 {sessionNumber} · {isMe ? "내" : `User ${viewUserId}의`} 매치 기록
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
                  {opponent !== null ? `vs  User ${opponent}` : "부전승"}
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
// 동점 그룹은 첫 줄에만 등수를 표시하고 나머지는 묶음으로 표현하기 위한 플래그 포함
type TiedRank = {
  displayRank: number;
  isFirstInGroup: boolean;  // 그룹의 첫 줄 (등수 표시)
  isTiedStart: boolean;     // 뒤에 동점자가 있는 첫 줄
  isTiedCont: boolean;      // 위와 동점인 연속 줄
  isTiedLast: boolean;      // 동점 그룹의 마지막 줄
};
function computeTiedRanks<T extends { points: number }>(entries: T[]): (T & TiedRank)[] {
  const sorted = [...entries].sort((a, b) => b.points - a.points);
  const ranked = sorted.map((entry, idx) => {
    const isFirstInGroup = idx === 0 || sorted[idx - 1].points !== entry.points;
    const displayRank = isFirstInGroup ? idx + 1 : (sorted[idx - 1] as any).displayRank;
    return { ...entry, displayRank, isFirstInGroup };
  });
  return ranked.map((entry, idx) => {
    const hasFollower = idx < ranked.length - 1 && ranked[idx + 1].points === entry.points;
    return {
      ...entry,
      isTiedStart: entry.isFirstInGroup && hasFollower,
      isTiedCont:  !entry.isFirstInGroup,
      isTiedLast:  !entry.isFirstInGroup && !hasFollower,
    };
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
        console.group(`[LeaderboardTab] 세션 ${selectedSession} 리더보드 수신`);
        console.log("session_number     :", res.session_number);
        console.log("total_participants :", res.total_participants);
        console.log("total_rounds       :", res.total_rounds);
        console.table(res.final_standings.map(s => ({
          rank: s.rank, user_id: s.user_id,
          wins: s.wins, draws: s.draws, losses: s.losses, points: s.points,
        })));
        console.groupEnd();
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
        console.group(`[LeaderboardTab] middleRanking — contest=${contestId} session=${selectedSession} user=${userId}`);
        console.log("raw response :", res);
        console.groupEnd();
        setMiddleCache(prev => new Map(prev).set(userId, res));
      })
      .catch(err => {
        console.error(`[LeaderboardTab] middleRanking 오류 — contest=${contestId} session=${selectedSession} user=${userId}`, err?.response ?? err);
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
          {computeTiedRanks(data.final_standings).map((s) => {
            const isMe       = myUserId !== undefined && s.user_id === myUserId;
            const isExpanded = expandedUserId === s.user_id;
            const rankClass  = s.displayRank <= 3 ? ` lb-card--rank${s.displayRank}` : "";
            const tieClass   =
              (s.isTiedStart ? " lb-card--tied-start" : "") +
              (s.isTiedCont  ? " lb-card--tied-cont"  : "") +
              (s.isTiedLast  ? " lb-card--tied-last"  : "");

            return (
              <React.Fragment key={s.user_id}>
                <div
                  className={`lb-card${rankClass}${tieClass} lb-card--expandable`}
                  onClick={() => handleCardClick(s.user_id)}
                >
                  <div className="lb-rank">
                    {s.isFirstInGroup
                      ? <span className="lb-rank-num">{s.displayRank}</span>
                      : <span className="lb-tie-dot" aria-label={`공동 ${s.displayRank}위`}>·</span>}
                  </div>
                  <div className="lb-info">
                    <span className="lb-user-id">
                      User {s.user_id}
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
                    isMe={isMe}
                    hasVisualization={hasVisualization}
                    matches={middleCache.get(s.user_id) ?? null}
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
