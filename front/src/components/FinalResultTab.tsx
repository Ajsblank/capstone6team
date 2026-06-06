import React, { useState, useEffect, useCallback } from "react";
import { getFinalResult, FinalStanding, getFullLeagueMatchLog } from "../api/codeBattleApi";
import "./FinalResultTab.css";

interface Props {
  contestId: number;
  myUserId?: number;
  hasVizHtml?: boolean;
  onLogView?: (log: string) => void;
}

// ── 공동 순위 계산 (같은 승점 → 같은 등수, 다음 등수는 건너뜀) ────────────────────
// 동점 그룹은 첫 줄에만 등수를 표시하고 나머지는 묶음으로 표현하기 위한 플래그 포함
type TiedRank = {
  displayRank: number;
  isFirstInGroup: boolean;
  isTiedStart: boolean;
  isTiedCont: boolean;
  isTiedLast: boolean;
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

const FinalResultTab: React.FC<Props> = ({ contestId, myUserId, hasVizHtml, onLogView }) => {
  const [standings, setStandings]                 = useState<FinalStanding[]>([]);
  const [totalParticipants, setTotalParticipants] = useState<number>(0);
  const [loading, setLoading]                     = useState(false);
  const [error, setError]                         = useState<string | null>(null);

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
        console.log("[FinalResultTab] 서버 응답:", data);
        setTotalParticipants(data.total_participants);
        const sorted = [...data["final-standings"]].sort((a, b) => a.rank - b.rank);
        console.log("[FinalResultTab] 정렬된 순위:", sorted);
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
      console.log("[FinalResultTab] 매치 로그 응답 (matchId=%d):", matchId, log);
      setMatchLog(log);
    } catch (e) {
      console.error("[FinalResultTab] 매치 로그 로드 실패 (matchId=%d):", matchId, e);
      setMatchLogError("로그를 불러오지 못했습니다.");
    } finally {
      setMatchLogLoading(false);
    }
  }, [contestId]);

  if (loading) return <div className="fr-empty">불러오는 중...</div>;
  if (error)   return <div className="fr-empty fr-empty--error">{error}</div>;
  if (standings.length === 0) return <div className="fr-empty">최종 결과가 없습니다.</div>;

  return (
    <div className="fr-container">
      <div className="fr-header">
        <h2 className="fr-title">최종 결과</h2>
        <span className="fr-meta">총 {totalParticipants}명 참가</span>
      </div>

      <div className="fr-list">
        {computeTiedRanks(standings).map(s => {
          const total       = s.wins + s.draws + s.losses;
          const isMe        = myUserId !== undefined && s.user_id === myUserId;
          const isExpanded  = expandedUserId === s.user_id;
          const sortedMatchIds = [...(s.match_ids ?? [])].sort((a, b) => a - b);
          const hasMatchIds = sortedMatchIds.length > 0;

          const tieClass =
            (s.isTiedStart ? " fr-card--tied-start" : "") +
            (s.isTiedCont  ? " fr-card--tied-cont"  : "") +
            (s.isTiedLast  ? " fr-card--tied-last"  : "");

          return (
            <div key={s.user_id} className="fr-card-wrap">
              <div className={`fr-card${s.displayRank <= 3 ? ` fr-card--rank${s.displayRank}` : ""}${tieClass}${isExpanded ? " fr-card--expanded" : ""}`}>
                <div className="fr-rank">
                  {s.isFirstInGroup
                    ? <span className="fr-rank-num">{s.displayRank}</span>
                    : <span className="fr-tie-dot" aria-label={`공동 ${s.displayRank}위`}>·</span>}
                </div>

                <div className="fr-info">
                  <span className="fr-user-id">
                    User {s.user_id}
                    {isMe && <span className="fr-me-badge">나</span>}
                  </span>
                  <span className="fr-record">
                    <span className="fr-wins">{s.wins}승</span>
                    <span className="fr-draws">{s.draws}무</span>
                    <span className="fr-losses">{s.losses}패</span>
                    {total > 0 && <span className="fr-total"> / {total}전</span>}
                  </span>
                </div>

                <div className="fr-points">
                  <span className="fr-points-num">{s.points}</span>
                  <span className="fr-points-label">pts</span>
                </div>

                {hasMatchIds && (
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
