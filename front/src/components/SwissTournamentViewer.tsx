import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { SessionPayload, SessionRound, SessionMatch } from "./SessionDetailPanel";
import "../pages/SwissTournamentPage.css";

// ─── Internal types ────────────────────────────────────────────────────────────

type VResult = "p1" | "p2" | "draw" | null;

interface VMatch {
  id: string;
  matchId: number;
  p1Id: number;
  p2Id: number;  // -1 = BYE
  isBye: boolean;
  result: VResult;
  animKey: number;
}

interface VPool {
  id: string;
  points: number;
  label: string;
  colorT: number;   // 0 = 최하위(빨강) ~ 1 = 최상위(초록)
  matches: VMatch[];
}

interface VRound {
  roundNumber: number;
  pools: VPool[];
  completed: boolean;
}

interface VStanding {
  playerId: number;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  rank: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pName(id: number) { return `U${id}`; }

function pointsBeforeRound(rounds: SessionRound[], playerId: number, beforeRoundNumber: number): number {
  let pts = 0;
  for (const r of rounds) {
    if (r.round_number >= beforeRoundNumber) continue;
    for (const m of r.matches) {
      const isDraw = m.winner === 0 || m.result === "DRAW";
      if (m.user1_id === playerId) {
        if (isDraw) { /* 0점 */ }
        else if (m.winner === 1 || m.result === "BYE") pts += 1;
        else if (m.winner === 2) pts -= 1;
      } else if (m.user2_id === playerId) {
        if (isDraw) { /* 0점 */ }
        else if (m.winner === 2) pts += 1;
        else if (m.winner === 1) pts -= 1;
      }
    }
  }
  return pts;
}

function toVResult(m: SessionMatch): VResult {
  if (m.result === "DRAW")             return "draw";
  if (m.result === "WIN1" || m.result === "BYE") return "p1";
  if (m.result === "WIN2")             return "p2";
  // result가 없을 경우 winner 필드로 폴백
  if (m.winner === null) return null;
  if (m.winner === 0)    return "draw";
  return m.winner === 1 ? "p1" : "p2";
}

function buildVRounds(rounds: SessionRound[], animKeyMap: Map<number, number>): VRound[] {
  return rounds.map(br => {
    const poolMap = new Map<number, { points: number; matches: VMatch[] }>();

    for (const m of br.matches) {
      const p1pts = pointsBeforeRound(rounds, m.user1_id, br.round_number);
      let poolPts = p1pts;

      if (m.user2_id !== null) {
        const p2pts = pointsBeforeRound(rounds, m.user2_id, br.round_number);
        if (p2pts > p1pts) poolPts = p2pts;
      }

      if (!poolMap.has(poolPts)) poolMap.set(poolPts, { points: poolPts, matches: [] });
      poolMap.get(poolPts)!.matches.push({
        id: `m${m.match_id}`,
        matchId: m.match_id,
        p1Id: m.user1_id,
        p2Id: m.user2_id ?? -1,
        isBye: m.user2_id === null,
        result: toVResult(m),
        animKey: animKeyMap.get(m.match_id) ?? 0,
      });
    }

    const pointLabel = (pts: number) =>
      br.round_number === 1 ? "전체" : pts > 0 ? `+${pts}점` : `${pts}점`;

    const sorted = Array.from(poolMap.values())
      .sort((a, b) => b.points - a.points);

    const n = sorted.length;
    const pools: VPool[] = sorted.map((p, i) => ({
      id: `r${br.round_number}-pool-${i}`,
      points: p.points,
      label: pointLabel(p.points),
      colorT: n === 1 ? 0.6 : (n - 1 - i) / (n - 1),
      matches: p.matches,
    }));

    return { roundNumber: br.round_number, pools, completed: br.status === "FINISHED" || br.status === "END" };
  });
}

function computeVStandings(rounds: SessionRound[], playerIds: number[]): VStanding[] {
  const list = playerIds.map(id => {
    let wins = 0, losses = 0, draws = 0;
    for (const r of rounds) {
      for (const m of r.matches) {
        const isDraw = m.winner === 0 || m.result === "DRAW";
        if (m.user1_id === id) {
          if (isDraw) draws++;
          else if (m.winner === 1 || m.result === "WIN1" || m.result === "BYE") wins++;
          else if (m.winner === 2 || m.result === "WIN2") losses++;
        } else if (m.user2_id === id) {
          if (isDraw) draws++;
          else if (m.winner === 2 || m.result === "WIN2") wins++;
          else if (m.winner === 1 || m.result === "WIN1") losses++;
        }
      }
    }
    return { playerId: id, wins, losses, draws, points: wins - losses };
  });
  list.sort((a, b) => b.points - a.points || b.wins - a.wins);
  return list.map((s, i) => ({ ...s, rank: i + 1 }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface VMatchRowProps {
  match: VMatch;
  trackedId: number | null;
  selected: boolean;
  onSelect: () => void;
  setRef: (id: string, el: HTMLDivElement | null) => void;
}

const VMatchRow: React.FC<VMatchRowProps> = ({ match, trackedId, selected, onSelect, setRef }) => {
  const { result, isBye, p1Id, p2Id, id } = match;
  const p1Win  = result === "p1";
  const p2Win  = result === "p2";
  const isDraw = result === "draw";

  if (isBye) {
    return (
      <div
        ref={el => setRef(id, el)}
        className={`st-bye-row${trackedId === p1Id ? " st-bye-row--tracked" : ""}`}
      >
        <span className={`st-bye-name${trackedId === p1Id ? " st-bye-name--tracked" : ""}`}>
          {pName(p1Id)}
        </span>
        <span className="st-bye-badge">부전승</span>
      </div>
    );
  }

  const isTracked = trackedId === p1Id || trackedId === p2Id;

  const rowCls = [
    "st-match",
    selected       ? "st-match--selected"  : "",
    result         ? "st-match--resolved"  : "st-match--pending",
    result         ? `st-match--${result}` : "",
    isTracked      ? "st-match--tracked"   : "",
  ].filter(Boolean).join(" ");

  const p1HalfCls = [
    "st-match-half st-match-half--left",
    p1Win ? "st-match-half--win" : p2Win ? "st-match-half--lose" : isDraw ? "st-match-half--draw" : "",
    trackedId === p1Id ? "st-match-half--tracked" : "",
  ].filter(Boolean).join(" ");

  const p2HalfCls = [
    "st-match-half st-match-half--right",
    p2Win ? "st-match-half--win" : p1Win ? "st-match-half--lose" : isDraw ? "st-match-half--draw" : "",
    trackedId === p2Id ? "st-match-half--tracked" : "",
  ].filter(Boolean).join(" ");

  return (
    <div ref={el => setRef(id, el)} className={rowCls} onClick={onSelect}>
      {/* 좌측 — 플레이어 1 */}
      <div className={p1HalfCls}>
        <span className="st-match-pname">{pName(p1Id)}</span>
        <span className="st-result-slot">
          {p1Win  && <span className="st-win-icon">W</span>}
          {p2Win  && <span className="st-lose-icon">L</span>}
          {isDraw && <span className="st-draw-icon">D</span>}
        </span>
      </div>

      {/* VS 구분선 */}
      <div className={`st-match-vs-divider${selected ? " st-match-vs-divider--active" : ""}`}>
        <span>VS</span>
        {selected && <span className="st-vs-pulse" />}
      </div>

      {/* 우측 — 플레이어 2 */}
      <div className={p2HalfCls}>
        <span className="st-result-slot">
          {p1Win  && <span className="st-lose-icon">L</span>}
          {p2Win  && <span className="st-win-icon">W</span>}
          {isDraw && <span className="st-draw-icon">D</span>}
        </span>
        <span className="st-match-pname">{pName(p2Id)}</span>
      </div>
    </div>
  );
};

interface VPoolCardProps {
  pool: VPool;
  trackedId: number | null;
  selectedMatchId: string | null;
  onSelect: (id: string) => void;
  setRef: (id: string, el: HTMLDivElement | null) => void;
}

function poolHsl(t: number, lightness = 62, sat = 80): string {
  const hue = Math.round(t * 120);   // 0° 빨강 → 120° 초록
  return `hsl(${hue}, ${sat}%, ${lightness}%)`;
}

const VPoolCard: React.FC<VPoolCardProps> = ({ pool, trackedId, selectedMatchId, onSelect, setRef }) => {
  const hasTracked = trackedId !== null &&
    pool.matches.some(m => m.p1Id === trackedId || m.p2Id === trackedId);

  const color      = poolHsl(pool.colorT);
  const colorDim   = poolHsl(pool.colorT, 18, 60);   // 헤더 배경 tint

  return (
    <div
      className={`st-pool st-pool--visible${hasTracked ? " st-pool--tracked" : ""}`}
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
    >
      <div className="st-pool-header" style={{ background: colorDim }}>
        <span className="st-pool-label" style={{ color, textShadow: `0 0 10px ${color}` }}>{pool.label}</span>
        <span className="st-pool-count">{pool.matches.length}경기</span>
      </div>
      <div className="st-pool-matches">
        {pool.matches.map(m => (
          <VMatchRow
            key={m.id}
            match={m}
            trackedId={trackedId}
            selected={selectedMatchId === m.id}
            onSelect={() => onSelect(m.id)}
            setRef={setRef}
          />
        ))}
      </div>
    </div>
  );
};

const RANK_COLORS = ["#fbbf24", "#94a3b8", "#d97706"];

interface VSidebarProps {
  standings: VStanding[];
  trackedId: number | null;
  onTrack: (id: number | null) => void;
  rankDeltaMap: Map<number, { delta: number; key: number }>;
  myUserId?: number;
}
const VSidebar: React.FC<VSidebarProps> = ({ standings, trackedId, onTrack, rankDeltaMap, myUserId }) => (
  <div className="st-ranking-sidebar">
    <div className="st-sidebar-header">
      <span className="st-sidebar-title">실시간 순위</span>
      {trackedId !== null && (
        <button className="st-sidebar-clear-btn" onClick={() => onTrack(null)}>추적 해제</button>
      )}
    </div>
    <div className="st-sidebar-list">
      {standings.map(s => {
        const delta = rankDeltaMap.get(s.playerId);
        const isTracked = trackedId === s.playerId;
        const isMe      = myUserId !== undefined && s.playerId === myUserId;
        const rankColor = s.rank <= 3 ? RANK_COLORS[s.rank - 1] : undefined;
        return (
          <div
            key={s.playerId}
            className={[
              "st-sidebar-row",
              isTracked ? "st-sidebar-row--tracked" : "",
              isMe      ? "st-sidebar-row--me"      : "",
            ].filter(Boolean).join(" ")}
            onClick={() => onTrack(isTracked ? null : s.playerId)}
          >
            <span className="st-sidebar-rank" style={rankColor ? { color: rankColor } : undefined}>
              #{s.rank}
            </span>
            <span className="st-sidebar-name">
              {pName(s.playerId)}
              {isMe && <span className="st-sidebar-me-badge">나</span>}
            </span>
            <span className="st-sidebar-record">
              <span className="st-rec-w">{s.wins}W</span>
              {s.draws > 0 && <span className="st-rec-d"> {s.draws}D</span>}
              <span className="st-rec-l"> {s.losses}L</span>
            </span>
            {delta && (
              <span key={delta.key} className={`st-rank-delta st-rank-delta--${delta.delta > 0 ? "up" : "down"}`}>
                {delta.delta > 0 ? `▲${delta.delta}` : `▼${Math.abs(delta.delta)}`}
              </span>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  payload: SessionPayload | null;
  myUserId?: number;
}

const SwissTournamentViewer: React.FC<Props> = ({ payload, myUserId }) => {
  const [trackedId,      setTrackedId]      = useState<number | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [animKeyMap,     setAnimKeyMap]     = useState<Map<number, number>>(new Map());
  const [rankDeltaMap,   setRankDeltaMap]   = useState<Map<number, { delta: number; key: number }>>(new Map());
  const [zoom,           setZoom]           = useState(1.0);

  const ZOOM_STEP = 0.1;
  const ZOOM_MIN  = 0.5;
  const ZOOM_MAX  = 1.5;

  const prevWinnersRef  = useRef<Map<number, 0 | 1 | 2 | null>>(new Map());
  const prevRankRef     = useRef<Map<number, number>>(new Map());
  const prevRoundCount  = useRef(0);
  const scrollRef       = useRef<HTMLDivElement>(null);

  // 매치 DOM 참조 맵 (자동 스크롤용)
  const matchRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const setMatchRef  = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) matchRefsMap.current.set(id, el);
    else    matchRefsMap.current.delete(id);
  }, []);

  // ── 신규 결과 animKey 갱신 ────────────────────────────────────────────────────
  useEffect(() => {
    if (!payload) return;
    const changed: number[] = [];
    for (const r of payload.rounds) {
      for (const m of r.matches) {
        const prev = prevWinnersRef.current.get(m.match_id);
        if ((prev === undefined || prev === null) && m.winner !== null) changed.push(m.match_id);
        prevWinnersRef.current.set(m.match_id, m.winner);
      }
    }
    if (changed.length > 0) {
      setAnimKeyMap(prev => {
        const next = new Map(prev);
        for (const id of changed) next.set(id, (next.get(id) ?? 0) + 1);
        return next;
      });
    }
  }, [payload]);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const playerIds = useMemo(() => {
    if (!payload) return [];
    const ids = new Set<number>();
    for (const r of payload.rounds) {
      for (const m of r.matches) {
        ids.add(m.user1_id);
        if (m.user2_id !== null) ids.add(m.user2_id);
      }
    }
    return Array.from(ids).sort((a, b) => a - b);
  }, [payload]);

  const vRounds = useMemo(
    () => (payload ? buildVRounds(payload.rounds, animKeyMap) : []),
    [payload, animKeyMap],
  );

  const standings = useMemo(
    () => (payload ? computeVStandings(payload.rounds, playerIds) : []),
    [payload, playerIds],
  );

  // ── 순위 변동 추적 ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (standings.length === 0) return;
    const updates: Array<[number, { delta: number; key: number }]> = [];
    standings.forEach(s => {
      const prev = prevRankRef.current.get(s.playerId);
      if (prev !== undefined && prev !== s.rank)
        updates.push([s.playerId, { delta: prev - s.rank, key: Date.now() + s.playerId }]);
    });
    if (updates.length > 0) {
      setRankDeltaMap(prev => {
        const next = new Map(prev);
        updates.forEach(([id, val]) => next.set(id, val));
        return next;
      });
    }
    const next = new Map<number, number>();
    standings.forEach(s => next.set(s.playerId, s.rank));
    prevRankRef.current = next;
  }, [standings]);

  // ── 새 라운드 등장 시 우측 자동 스크롤 ─────────────────────────────────────
  useEffect(() => {
    if (vRounds.length > prevRoundCount.current && scrollRef.current)
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    prevRoundCount.current = vRounds.length;
  }, [vRounds.length]);

  // ── 추적 플레이어 첫 매치로 자동 스크롤 ─────────────────────────────────────
  useEffect(() => {
    if (trackedId === null) return;
    for (const r of vRounds) {
      for (const pool of r.pools) {
        for (const m of pool.matches) {
          if (m.p1Id === trackedId || m.p2Id === trackedId) {
            const el = matchRefsMap.current.get(m.id);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
              return;
            }
          }
        }
      }
    }
  }, [trackedId, vRounds]);

  if (!payload || vRounds.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#6b7280", fontSize: "0.9rem" }}>
        시각화 데이터 대기 중...
      </div>
    );
  }

  const completedCount  = vRounds.filter(r => r.completed).length;
  const sessionDone     = payload.status === "FINISHED" || payload.status === "END";
  const totalMatches    = payload.rounds.flatMap(r => r.matches).length;
  const resolvedMatches = payload.rounds.flatMap(r => r.matches).filter(m => m.winner !== null).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0f1117" }}>

      {/* Controls bar */}
      <div className="st-controls" style={{ flexShrink: 0 }}>
        <div className="st-controls-left">
          <span className="st-controls-title">스위스 토너먼트</span>
          <div className="st-zoom-group">
            <button
              className="st-zoom-btn"
              onClick={() => setZoom(z => Math.max(ZOOM_MIN, parseFloat((z - ZOOM_STEP).toFixed(1))))}
              disabled={zoom <= ZOOM_MIN}
              title="축소"
            >−</button>
            <span className="st-zoom-label">{Math.round(zoom * 100)}%</span>
            <button
              className="st-zoom-btn"
              onClick={() => setZoom(z => Math.min(ZOOM_MAX, parseFloat((z + ZOOM_STEP).toFixed(1))))}
              disabled={zoom >= ZOOM_MAX}
              title="확대"
            >+</button>
          </div>
          <span className="st-controls-info">
            {completedCount}/{payload.total_rounds}라운드 · 매치 {resolvedMatches}/{totalMatches}
          </span>
        </div>
        {sessionDone && <span className="st-done-badge">완료</span>}
      </div>

      {/* Progress bar */}
      <div className="st-progress-bar" style={{ flexShrink: 0 }}>
        <div
          className="st-progress-fill"
          style={{ width: totalMatches > 0 ? `${(resolvedMatches / totalMatches) * 100}%` : "0%" }}
        />
      </div>

      {/* Main area */}
      <div className="st-main-area">
        <div className="st-bracket-scroll" ref={scrollRef}>
          <div className="st-bracket" style={{ zoom }}>
            {vRounds.map((r, idx) => (
              <React.Fragment key={r.roundNumber}>
                <div className="st-round-col">
                  <div className="st-round-header">
                    <span className="st-round-label">{r.roundNumber}차 경기</span>
                    {r.completed  && <span className="st-round-done">✓</span>}
                    {!r.completed && <span className="st-round-live">진행 중</span>}
                  </div>
                  <div className="st-pools">
                    {r.pools.length === 0 ? (
                      <div className="st-pools-pending">
                        <span className="st-pending-text">매치 배정 대기 중…</span>
                      </div>
                    ) : (
                      r.pools.map(pool => (
                        <VPoolCard
                          key={pool.id}
                          pool={pool}
                          trackedId={trackedId}
                          selectedMatchId={selectedMatchId}
                          onSelect={setSelectedMatchId}
                          setRef={setMatchRef}
                        />
                      ))
                    )}
                  </div>
                </div>
                {idx < vRounds.length - 1 && (
                  <div className="st-connector">
                    <span className="st-connector-arrow">›</span>
                  </div>
                )}
              </React.Fragment>
            ))}

            {!sessionDone && vRounds.length < payload.total_rounds && (
              <>
                <div className="st-connector">
                  <span className="st-connector-arrow st-connector-arrow--muted">›</span>
                </div>
                <div className="st-round-col st-round-col--pending">
                  <div className="st-round-header">
                    <span className="st-round-label st-round-label--muted">
                      {vRounds.length + 1}차 경기
                    </span>
                  </div>
                  <div className="st-pools-pending">
                    <span className="st-pending-text">결과 대기 중…</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {sessionDone && (
            <div className="st-standings">
              <h3 className="st-standings-title">최종 결과</h3>
              <div className="st-standings-list">
                {standings.map((s, i) => (
                  <div key={s.playerId} className="st-standing-row">
                    <span className="st-standing-rank" style={i < 3 ? { color: RANK_COLORS[i] } : undefined}>
                      #{s.rank}
                    </span>
                    <span className="st-standing-name">{pName(s.playerId)}</span>
                    <span className="st-standing-record">
                      {s.wins}승{s.draws > 0 ? ` ${s.draws}무` : ""} {s.losses}패
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <VSidebar
          standings={standings}
          trackedId={trackedId}
          onTrack={setTrackedId}
          rankDeltaMap={rankDeltaMap}
          myUserId={myUserId}
        />
      </div>
    </div>
  );
};

export default SwissTournamentViewer;
