import React, { useState, useEffect } from "react";
import { getFinalResult, FinalStanding } from "../api/codeBattleApi";
import "./FinalResultTab.css";

interface Props {
  contestId: number;
}

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const FinalResultTab: React.FC<Props> = ({ contestId }) => {
  const [standings, setStandings]             = useState<FinalStanding[]>([]);
  const [totalParticipants, setTotalParticipants] = useState<number>(0);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);

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
        {standings.map(s => {
          const total = s.wins + s.draws + s.losses;
          const medal = RANK_MEDAL[s.rank];
          return (
            <div
              key={s.user_id}
              className={`fr-card${s.rank <= 3 ? ` fr-card--rank${s.rank}` : ""}`}
            >
              <div className="fr-rank">
                {medal
                  ? <span className="fr-medal">{medal}</span>
                  : <span className="fr-rank-num">{s.rank}</span>
                }
              </div>

              <div className="fr-info">
                <span className="fr-user-id">User {s.user_id}</span>
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
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FinalResultTab;
