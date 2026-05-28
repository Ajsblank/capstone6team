import React, { useState, useEffect } from "react";
import { getSessionLeaderboard, SessionLeaderboard, LeaderboardStanding } from "../api/codeBattleApi";
import "./LeaderboardTab.css";

interface Props {
  contestId: number;
  myUserId?: number;
}

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const LeaderboardTab: React.FC<Props> = ({ contestId, myUserId }) => {
  const [data,    setData]    = useState<SessionLeaderboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getSessionLeaderboard(contestId)
      .then(res  => { if (!cancelled) setData(res); })
      .catch(()  => { if (!cancelled) setError("리더보드를 불러오지 못했습니다."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [contestId]);

  if (loading) return <div className="lb-empty">불러오는 중...</div>;
  if (error)   return <div className="lb-empty lb-empty--error">{error}</div>;
  if (!data || data.final_standings.length === 0)
    return <div className="lb-empty">리더보드 정보가 없습니다.</div>;

  const sorted = [...data.final_standings].sort((a, b) => a.rank - b.rank);

  return (
    <div className="lb-container">
      <div className="lb-header">
        <h2 className="lb-title">리더보드</h2>
        <span className="lb-meta">
          세션 {data.session_number} · {data.total_participants}명 · {data.total_rounds}라운드
        </span>
      </div>

      <div className="lb-list">
        {sorted.map((s: LeaderboardStanding) => {
          const isMe      = myUserId !== undefined && s.user_id === myUserId;
          const rankClass = s.rank <= 3 ? ` lb-card--rank${s.rank}` : "";
          const meClass   = isMe ? " lb-card--me" : "";

          return (
            <div key={s.user_id} className={`lb-card${rankClass}${meClass}`}>
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
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LeaderboardTab;
