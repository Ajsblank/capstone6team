import React, { useState, useEffect, useCallback } from "react";
import { getFinalResult, FinalStanding, getFullLeagueMatchLog } from "../api/codeBattleApi";
import "./FinalResultTab.css";

interface Props {
  contestId: number;
  myUserId?: number;
  hasVizHtml?: boolean;
  onLogView?: (log: string) => void;
  endDate?: string;
}

type ContestPhase = "ongoing" | "league-running" | "ended" | "unknown";

function getContestPhase(endDate?: string): ContestPhase {
  if (!endDate) return "unknown";
  const end = new Date(endDate);
  const now = new Date();
  if (now < end) return "ongoing";
  if (now < new Date(end.getTime() + 6 * 60 * 60 * 1000)) return "league-running";
  return "ended";
}

function formatEndDate(endDate: string): string {
  const d = new Date(endDate);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// ── 공동 순위 계산 (같은 승점 → 같은 등수, 다음 등수는 건너뜀) ────────────────────
// 모든 행에 등수를 부여하되 동점이면 같은 숫자(예: 1,1,1,4)
function renderNickTag(value: string): React.ReactNode {
  const i = value.lastIndexOf('-');
  if (i === -1) return value;
  return <>{value.slice(0, i)}<span className="fr-nick-tag">#{value.slice(i + 1)}</span></>;
}

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

const FinalResultTab: React.FC<Props> = ({ contestId, myUserId, hasVizHtml, onLogView, endDate }) => {
  const [standings, setStandings]                 = useState<FinalStanding[]>([]);
  const [totalParticipants, setTotalParticipants] = useState<number>(0);
  const [loading, setLoading]                     = useState(false);
  const [error, setError]                         = useState<string | null>(null);

  const [isMobile, setIsMobile] = useState(() =>
    window.matchMedia("(max-width: 768px)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const [expandedUserId, setExpandedUserId]     = useState<number | null>(null);
  const [selectedMatchId, setSelectedMatchId]   = useState<number | null>(null);
  const [selectedMatchIdx, setSelectedMatchIdx] = useState<number | null>(null);
  const [matchLog, setMatchLog]                 = useState<string | null>(null);
  const [matchLogLoading, setMatchLogLoading]   = useState(false);
  const [matchLogError, setMatchLogError]       = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getFinalResult(contestId)
      .then(data => {
        if (cancelled) return;
        setTotalParticipants(data.total_participants);
        const sorted = [...data["final-standings"]].sort((a, b) => a.rank - b.rank);
        setStandings(sorted);
      })
      .catch(() => { if (!cancelled) setError("최종 결과를 불러오지 못했습니다."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [contestId]);

  const toggleExpanded = (userId: number) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
    } else {
      setExpandedUserId(userId);
      setSelectedMatchId(null);
      setSelectedMatchIdx(null);
      setMatchLog(null);
      setMatchLogError(null);
    }
  };

  const loadMatchLog = useCallback(async (matchId: number, matchIdx: number) => {
    setSelectedMatchId(matchId);
    setSelectedMatchIdx(matchIdx);
    setMatchLog(null);
    setMatchLogError(null);
    setMatchLogLoading(true);
    try {
      const log = await getFullLeagueMatchLog(contestId, matchId);
      setMatchLog(log);
    } catch (e) {
      setMatchLogError("로그를 불러오지 못했습니다.");
    } finally {
      setMatchLogLoading(false);
    }
  }, [contestId]);

  if (loading) return <div className="fr-empty">불러오는 중...</div>;

  const phase = getContestPhase(endDate);

  if (error || standings.length === 0) {
    if (phase === "ongoing") {
      return (
        <div className="fr-notice">
          <p>최종 결과는 <span className="fr-notice-date">{formatEndDate(endDate!)}</span> 이후 진행되는 풀리그 경기가 끝나면 확인하실 수 있습니다.</p>
        </div>
      );
    }
    if (phase === "league-running") {
      return (
        <div className="fr-notice">
          <p>현재 풀리그 경기가 진행 중입니다. 경기가 끝나면 결과를 확인해보실 수 있습니다.</p>
        </div>
      );
    }
    if (error) return <div className="fr-empty fr-empty--error">{error}</div>;
    return <div className="fr-empty">최종 결과가 없습니다.</div>;
  }

  return (
    <div className="fr-container">
      <div className="fr-header">
        <h2 className="fr-title">최종 결과</h2>
        <span className="fr-meta">총 {totalParticipants}명 참가</span>
      </div>

      {isMobile && (
        <div className="fr-mobile-hint">목록을 눌러 자세히 보기</div>
      )}

      <div className="fr-list">
        {computeTiedRanks(standings).map(s => {
          const total       = s.wins + s.draws + s.losses;
          const isMe        = myUserId !== undefined && s.user_id === myUserId;
          const displayName = s.nickname_tag ?? `User ${s.user_id}`;
          const isExpanded  = expandedUserId === s.user_id;
          const sortedMatchIds = [...(s.match_ids ?? [])].sort((a, b) => a - b);
          const hasMatchIds = sortedMatchIds.length > 0;

          return (
            <div key={s.user_id} className="fr-card-wrap">
              <div
                className={`fr-card${s.displayRank <= 3 ? ` fr-card--rank${s.displayRank}` : ""}${isExpanded ? " fr-card--expanded" : ""}${isMobile && hasMatchIds ? " fr-card--mobile-clickable" : ""}`}
                onClick={isMobile && hasMatchIds ? () => toggleExpanded(s.user_id) : undefined}
              >
                <div className="fr-rank">
                  <span className="fr-rank-num">{s.displayRank}</span>
                </div>

                <div className="fr-info">
                  <span className="fr-user-id">
                    {renderNickTag(displayName)}
                    {isMe && <span className="fr-me-badge">나</span>}
                  </span>
                  <span className="fr-record">
                    <span className="fr-wins">{s.wins}승</span>
                    <span className="fr-draws">{s.draws}무</span>
                    <span className="fr-losses">{s.losses}패</span>
                    {total > 0 && <span className="fr-total">· {total}전</span>}
                  </span>
                </div>

                <div className="fr-points">
                  <span className="fr-points-num">{s.points}</span>
                  <span className="fr-points-label">pts</span>
                </div>

                {hasMatchIds && !isMobile && (
                  <button
                    className={`fr-detail-btn${isExpanded ? " fr-detail-btn--open" : ""}`}
                    onClick={() => toggleExpanded(s.user_id)}
                  >
                    {isExpanded ? "접기" : "자세히 보기"}
                  </button>
                )}
              </div>

              {isExpanded && hasMatchIds && (
                <div className="fr-detail-panel">
                  <div className="fr-match-heading">매치 목록</div>
                  <div className="fr-match-list">
                    {sortedMatchIds.map((mid, idx) => (
                      <button
                        key={mid}
                        className={`fr-match-pill${selectedMatchId === mid ? " fr-match-pill--active" : ""}`}
                        onClick={() => loadMatchLog(mid, idx + 1)}
                      >
                        매치 {idx + 1}
                      </button>
                    ))}
                  </div>

                  {matchLogLoading && (
                    <div className="fr-log-status">로그 불러오는 중...</div>
                  )}
                  {matchLogError && !matchLogLoading && (
                    <div className="fr-log-status fr-log-status--error">{matchLogError}</div>
                  )}
                  {matchLog !== null && !matchLogLoading && !matchLogError && (
                    <div className="fr-log-section">
                      <div className="fr-log-header">
                        <span className="fr-log-title">매치 {selectedMatchIdx} 로그</span>
                        {hasVizHtml && onLogView && matchLog.trim() && (
                          <button
                            className="fr-go-viz-btn"
                            onClick={() => onLogView(matchLog)}
                          >
                            로그 보러 가기
                          </button>
                        )}
                      </div>
                      {matchLog.trim()
                        ? <pre className="fr-log-text">{matchLog}</pre>
                        : <div className="fr-log-status">로그 내용이 없습니다.</div>
                      }
                    </div>
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

export default FinalResultTab;
