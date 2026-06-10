import React, { useState, useEffect, useReducer, useCallback, useMemo, useRef } from "react";
import "./SwissTournamentPage.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchResult = "p1" | "p2" | null;
type SimState = "setup" | "running" | "paused" | "done";

interface Player { id: number; name: string; }

interface Match {
  id: string;
  p1Id: number;
  p2Id: number;
  result: MatchResult;
  animKey: number;
}

interface Pool {
  id: string;
  wins: number;
  losses: number;
  playerIds: number[];
  matches: Match[];
}

interface Round {
  index: number;
  pools: Pool[];
  completed: boolean;
  visible: boolean;
}

interface TournamentState {
  simState: SimState;
  players: Player[];
  rounds: Round[];
  currentRoundIdx: number;
  totalRounds: number;
  selectedMatchId: string | null;
}

interface Standing {
  playerId: number;
  name: string;
  wins: number;
  losses: number;
  rank: number;
}

type Action =
  | { type: "START"; count: number; totalRounds: number }
  | { type: "RESOLVE_NEXT" }
  | { type: "ADVANCE_ROUND" }
  | { type: "SHOW_ROUND"; idx: number }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "END_ALL" }
  | { type: "SELECT_MATCH"; id: string | null }
  | { type: "RESET" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomResult(): MatchResult {
  return Math.random() < 0.5 ? "p1" : "p2";
}

function minRounds(n: number): number {
  return Math.max(2, Math.ceil(Math.log2(Math.max(n, 2))));
}

function getPlayerStats(rounds: Round[], playerId: number, upToRound: number): { wins: number; losses: number } {
  let wins = 0, losses = 0;
  for (let r = 0; r < upToRound && r < rounds.length; r++) {
    for (const pool of rounds[r].pools) {
      for (const m of pool.matches) {
        if (!m.result) continue;
        if (m.p1Id === playerId) { if (m.result === "p1") wins++; else losses++; }
        else if (m.p2Id === playerId) { if (m.result === "p2") wins++; else losses++; }
      }
    }
  }
  return { wins, losses };
}

// 현재 진행 중인 매치 결과까지 포함한 실시간 스탠딩
function computeStandings(rounds: Round[], players: Player[]): Standing[] {
  const stats = players.map(p => {
    let wins = 0, losses = 0;
    for (const r of rounds) {
      for (const pool of r.pools) {
        for (const m of pool.matches) {
          if (!m.result) continue;
          if (m.p1Id === p.id) { if (m.result === "p1") wins++; else losses++; }
          else if (m.p2Id === p.id) { if (m.result === "p2") wins++; else losses++; }
        }
      }
    }
    return { playerId: p.id, name: p.name, wins, losses };
  });
  stats.sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  return stats.map((s, i) => ({ ...s, rank: i + 1 }));
}

function buildRound(prevRounds: Round[], allPlayerIds: number[], roundIdx: number): Round {
  const groups = new Map<string, number[]>();
  for (const id of allPlayerIds) {
    const s = getPlayerStats(prevRounds, id, roundIdx);
    const key = `${s.wins}-${s.losses}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(id);
  }

  const pools: Pool[] = [];
  Array.from(groups.entries()).forEach(([key, pIds]) => {
    const parts = key.split("-");
    const w = parseInt(parts[0], 10);
    const l = parseInt(parts[1], 10);
    const shuffled = shuffle(pIds);
    const matches: Match[] = [];
    for (let i = 0; i + 1 < shuffled.length; i += 2) {
      matches.push({ id: `r${roundIdx}-${key}-m${i}`, p1Id: shuffled[i], p2Id: shuffled[i + 1], result: null, animKey: 0 });
    }
    pools.push({ id: `r${roundIdx}-${key}`, wins: w, losses: l, playerIds: pIds, matches });
  });

  pools.sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  return { index: roundIdx, pools, completed: false, visible: false };
}

function resolveRound(round: Round): Round {
  const pools = round.pools.map(p => ({
    ...p,
    matches: p.matches.map(m => m.result ? m : { ...m, result: randomResult(), animKey: m.animKey + 1 }),
  }));
  return { ...round, pools, completed: true };
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

const INIT: TournamentState = {
  simState: "setup", players: [], rounds: [], currentRoundIdx: 0, totalRounds: 0, selectedMatchId: null,
};

function reducer(state: TournamentState, action: Action): TournamentState {
  switch (action.type) {
    case "RESET": return INIT;

    case "START": {
      const players: Player[] = Array.from({ length: action.count }, (_, i) => ({ id: i + 1, name: `P${i + 1}` }));
      const round0 = buildRound([], players.map(p => p.id), 0);
      round0.visible = true;
      return { simState: "running", players, rounds: [round0], currentRoundIdx: 0, totalRounds: action.totalRounds, selectedMatchId: null };
    }

    case "RESOLVE_NEXT": {
      const rounds = state.rounds.map(r => ({ ...r, pools: r.pools.map(p => ({ ...p, matches: [...p.matches] })) }));
      const r = rounds[state.currentRoundIdx];
      if (!r) return state;
      for (const pool of r.pools) {
        const match = pool.matches.find(m => m.result === null);
        if (match) {
          match.result = randomResult();
          match.animKey = match.animKey + 1;
          r.completed = r.pools.every(p => p.matches.every(m => m.result !== null));
          return { ...state, rounds };
        }
      }
      r.completed = true;
      return { ...state, rounds };
    }

    case "ADVANCE_ROUND": {
      const r = state.rounds[state.currentRoundIdx];
      if (!r?.completed) return state;
      const nextIdx = state.currentRoundIdx + 1;
      if (nextIdx >= state.totalRounds) return { ...state, simState: "done" };
      const allIds = state.players.map(p => p.id);
      const nextRound = buildRound(state.rounds, allIds, nextIdx);
      return { ...state, rounds: [...state.rounds, nextRound], currentRoundIdx: nextIdx };
    }

    case "SHOW_ROUND": {
      const rounds = state.rounds.map((r, i) => i === action.idx ? { ...r, visible: true } : r);
      return { ...state, rounds };
    }

    case "PAUSE":  return { ...state, simState: "paused" };
    case "RESUME": return { ...state, simState: "running" };

    case "END_ALL": {
      const allIds = state.players.map(p => p.id);
      let rounds = state.rounds.map((r, i) =>
        i <= state.currentRoundIdx ? resolveRound({ ...r, visible: true }) : r
      );
      let idx = state.currentRoundIdx;
      while (rounds.length < state.totalRounds) {
        const next = buildRound(rounds, allIds, rounds.length);
        rounds = [...rounds, resolveRound({ ...next, visible: true })];
        idx = rounds.length - 1;
      }
      return { ...state, simState: "done", rounds, currentRoundIdx: idx };
    }

    case "SELECT_MATCH":
      return { ...state, selectedMatchId: state.selectedMatchId === action.id ? null : action.id };

    default: return state;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function playerName(players: Player[], id: number) {
  return players.find(p => p.id === id)?.name ?? `P${id}`;
}

interface MatchRowProps {
  match: Match;
  players: Player[];
  selected: boolean;
  trackedPlayerId: number | null;
  onSelect: () => void;
}
const MatchRow: React.FC<MatchRowProps> = ({ match, players, selected, trackedPlayerId, onSelect }) => {
  const p1Win = match.result === "p1";
  const p2Win = match.result === "p2";
  const p1Tracked = trackedPlayerId === match.p1Id;
  const p2Tracked = trackedPlayerId === match.p2Id;
  const hasTracked = p1Tracked || p2Tracked;

  return (
    <div
      className={[
        "st-match",
        selected ? "st-match--selected" : "",
        match.result ? "st-match--resolved" : "",
        `st-match--${match.result ?? "pending"}`,
        hasTracked ? "st-match--tracked" : "",
      ].filter(Boolean).join(" ")}
      onClick={onSelect}
    >
      <span className={`st-match-player${p1Win ? " st-match-player--win" : match.result ? " st-match-player--loss" : ""}${p1Tracked ? " st-match-player--tracked" : ""}`}>
        {playerName(players, match.p1Id)}
      </span>
      <span className={`st-match-vs${selected ? " st-match-vs--active" : ""}`}>
        vs
        {selected && !match.result && <span className="st-vs-pulse" key={`vp-${match.id}`} />}
      </span>
      <span className={`st-match-player${p2Win ? " st-match-player--win" : match.result ? " st-match-player--loss" : ""}${p2Tracked ? " st-match-player--tracked" : ""}`}>
        {playerName(players, match.p2Id)}
      </span>
      {match.result && (
        <span key={match.animKey} className={`st-result-badge st-result-badge--${match.result}`}>
          {p1Win ? "← 승" : "승 →"}
        </span>
      )}
    </div>
  );
};

interface PoolCardProps {
  pool: Pool;
  players: Player[];
  selectedMatchId: string | null;
  trackedPlayerId: number | null;
  onSelectMatch: (id: string) => void;
  visible: boolean;
}
const PoolCard: React.FC<PoolCardProps> = ({ pool, players, selectedMatchId, trackedPlayerId, onSelectMatch, visible }) => {
  const label = pool.wins === 0 && pool.losses === 0 ? "전체" : `${pool.wins}승 ${pool.losses}패`;
  const matchedIds = new Set(pool.matches.flatMap(m => [m.p1Id, m.p2Id]));
  const byePlayerIds = pool.playerIds.filter(id => !matchedIds.has(id));
  const poolHasTracked = trackedPlayerId !== null && pool.playerIds.includes(trackedPlayerId);

  return (
    <div className={`st-pool${visible ? " st-pool--visible" : ""}${poolHasTracked ? " st-pool--tracked" : ""}`}>
      <div className="st-pool-header">
        <span className="st-pool-label">{label}</span>
        <span className="st-pool-count">{pool.playerIds.length}명</span>
      </div>
      <div className="st-pool-matches">
        {pool.matches.map(m => (
          <MatchRow
            key={m.id}
            match={m}
            players={players}
            selected={selectedMatchId === m.id}
            trackedPlayerId={trackedPlayerId}
            onSelect={() => onSelectMatch(m.id)}
          />
        ))}
        {byePlayerIds.map(id => (
          <div key={id} className={`st-bye-row${trackedPlayerId === id ? " st-bye-row--tracked" : ""}`}>
            <span className={`st-bye-name${trackedPlayerId === id ? " st-bye-name--tracked" : ""}`}>
              {playerName(players, id)}
            </span>
            <span className="st-bye-badge">부전승</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Ranking Sidebar ──────────────────────────────────────────────────────────

interface RankDelta { delta: number; key: number; }

interface RankingSidebarProps {
  standings: Standing[];
  rankDeltaMap: Map<number, RankDelta>;
  trackedPlayerId: number | null;
  onTrack: (id: number | null) => void;
}

const RANK_COLORS = ["#fbbf24", "#94a3b8", "#d97706"];

const RankingSidebar: React.FC<RankingSidebarProps> = ({ standings, rankDeltaMap, trackedPlayerId, onTrack }) => (
  <div className="st-ranking-sidebar">
    <div className="st-sidebar-header">
      <span className="st-sidebar-title">실시간 순위</span>
      {trackedPlayerId !== null && (
        <button className="st-sidebar-clear-btn" onClick={() => onTrack(null)}>추적 해제</button>
      )}
    </div>
    <div className="st-sidebar-list">
      {standings.map(s => {
        const delta = rankDeltaMap.get(s.playerId);
        const isTracked = trackedPlayerId === s.playerId;
        const rankColor = s.rank <= 3 ? RANK_COLORS[s.rank - 1] : undefined;
        return (
          <div
            key={s.playerId}
            className={`st-sidebar-row${isTracked ? " st-sidebar-row--tracked" : ""}`}
            onClick={() => onTrack(isTracked ? null : s.playerId)}
          >
            <span className="st-sidebar-rank" style={rankColor ? { color: rankColor } : undefined}>
              #{s.rank}
            </span>
            <span className="st-sidebar-name">{s.name}</span>
            <span className="st-sidebar-record">{s.wins}W {s.losses}L</span>
            {delta && (
              <span
                key={delta.key}
                className={`st-rank-delta st-rank-delta--${delta.delta > 0 ? "up" : "down"}`}
              >
                {delta.delta > 0 ? `▲${delta.delta}` : `▼${Math.abs(delta.delta)}`}
              </span>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

// ─── Setup Screen ─────────────────────────────────────────────────────────────

interface SetupProps {
  count: number;
  setCount: (n: number) => void;
  rounds: number;
  setRounds: (n: number) => void;
  onStart: () => void;
}
const SetupScreen: React.FC<SetupProps> = ({ count, setCount, rounds, setRounds, onStart }) => (
  <div className="st-setup">
    <h2 className="st-setup-title">스위스 토너먼트 시각화</h2>
    <p className="st-setup-desc">참가자 수와 경기 수를 설정하고 시뮬레이션을 시작하세요.</p>
    <div className="st-setup-fields">
      <label className="st-setup-label">
        참가자 수
        <input
          className="st-setup-input"
          type="number" min={2} max={64} value={count}
          onChange={e => {
            const n = Math.max(2, Math.min(64, Number(e.target.value)));
            setCount(n);
            setRounds(Math.max(2, minRounds(n)));
          }}
        />
      </label>
      <label className="st-setup-label">
        경기 수 (최소 {minRounds(count)}회)
        <input
          className="st-setup-input"
          type="number" min={minRounds(count)} max={10} value={rounds}
          onChange={e => setRounds(Math.max(minRounds(count), Math.min(10, Number(e.target.value))))}
        />
      </label>
    </div>
    <div className="st-setup-info">
      <span>참가자 <strong>{count}</strong>명 · <strong>{rounds}</strong>차 경기</span>
    </div>
    <button className="st-start-btn" onClick={onStart}>시뮬레이션 시작 →</button>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const SwissTournamentPage: React.FC = () => {
  const [state, dispatch] = useReducer(reducer, INIT);
  const [count, setCount] = useState(8);
  const [rounds, setRounds] = useState(3);
  const [trackedPlayerId, setTrackedPlayerId] = useState<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 실시간 스탠딩 계산
  const currentStandings = useMemo(
    () => computeStandings(state.rounds, state.players),
    [state.rounds, state.players]
  );

  // 순위 변동 추적
  const prevRankRef = useRef<Map<number, number>>(new Map());
  const [rankDeltaMap, setRankDeltaMap] = useState<Map<number, RankDelta>>(new Map());

  useEffect(() => {
    if (currentStandings.length === 0) return;
    const updates: Array<[number, RankDelta]> = [];
    currentStandings.forEach(s => {
      const prev = prevRankRef.current.get(s.playerId);
      if (prev !== undefined && prev !== s.rank) {
        updates.push([s.playerId, { delta: prev - s.rank, key: Date.now() + s.playerId }]);
      }
    });
    if (updates.length > 0) {
      setRankDeltaMap(prev => new Map(Array.from(prev.entries()).concat(updates)));
    }
    const next = new Map<number, number>();
    currentStandings.forEach(s => next.set(s.playerId, s.rank));
    prevRankRef.current = next;
  }, [currentStandings]);

  // reset tracking on simulation restart
  useEffect(() => {
    if (state.simState === "setup") {
      setTrackedPlayerId(null);
      setRankDeltaMap(new Map());
      prevRankRef.current = new Map();
    }
  }, [state.simState]);

  // Auto-play
  useEffect(() => {
    if (tickRef.current) clearTimeout(tickRef.current);
    if (state.simState !== "running") return;
    const r = state.rounds[state.currentRoundIdx];
    if (!r) return;
    const hasUnresolved = r.pools.some(p => p.matches.some(m => m.result === null));
    if (hasUnresolved) {
      tickRef.current = setTimeout(() => dispatch({ type: "RESOLVE_NEXT" }), 500);
    } else {
      tickRef.current = setTimeout(
        () => dispatch(r.completed ? { type: "ADVANCE_ROUND" } : { type: "RESOLVE_NEXT" }),
        r.completed ? 900 : 100,
      );
    }
    return () => { if (tickRef.current) clearTimeout(tickRef.current); };
  });

  // 새 라운드 등장 애니메이션
  useEffect(() => {
    const r = state.rounds[state.currentRoundIdx];
    if (r && !r.visible) {
      const t = setTimeout(() => dispatch({ type: "SHOW_ROUND", idx: state.currentRoundIdx }), 80);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.rounds.length, state.currentRoundIdx]);

  const handleStart = useCallback(() => {
    dispatch({ type: "START", count, totalRounds: rounds });
  }, [count, rounds]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [state.rounds.length]);

  if (state.simState === "setup") {
    return (
      <div className="st-page">
        <SetupScreen count={count} setCount={setCount} rounds={rounds} setRounds={setRounds} onStart={handleStart} />
      </div>
    );
  }

  const completedRounds = state.rounds.filter(r => r.completed).length;
  const totalMatches    = state.rounds.flatMap(r => r.pools.flatMap(p => p.matches));
  const resolvedMatches = totalMatches.filter(m => m.result !== null).length;

  return (
    <div className="st-page">
      {/* Controls */}
      <div className="st-controls">
        <div className="st-controls-left">
          <span className="st-controls-title">스위스 토너먼트</span>
          <span className="st-controls-info">
            {completedRounds}/{state.totalRounds}라운드 · 매치 {resolvedMatches}/{totalMatches.length}
          </span>
        </div>
        <div className="st-controls-right">
          {state.simState === "running" && (
            <button className="st-btn st-btn--pause" onClick={() => dispatch({ type: "PAUSE" })}>⏸ 정지</button>
          )}
          {state.simState === "paused" && (
            <button className="st-btn st-btn--start" onClick={() => dispatch({ type: "RESUME" })}>▶ 재개</button>
          )}
          {state.simState !== "done" && (
            <button className="st-btn st-btn--end" onClick={() => dispatch({ type: "END_ALL" })}>⏭ 종료</button>
          )}
          {state.simState === "done" && <span className="st-done-badge">완료</span>}
          <button className="st-btn st-btn--reset" onClick={() => dispatch({ type: "RESET" })}>↺ 처음으로</button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="st-progress-bar">
        <div
          className="st-progress-fill"
          style={{ width: totalMatches.length > 0 ? `${(resolvedMatches / totalMatches.length) * 100}%` : "0%" }}
        />
      </div>

      {/* Main area: bracket + sidebar */}
      <div className="st-main-area">

        {/* Bracket */}
        <div className="st-bracket-scroll" ref={scrollRef}>
          <div className="st-bracket">
            {state.rounds.map((round, rIdx) => (
              <React.Fragment key={round.index}>
                <div className="st-round-col">
                  <div className="st-round-header">
                    <span className="st-round-label">{rIdx + 1}차 경기</span>
                    {round.completed && <span className="st-round-done">✓</span>}
                    {!round.completed && state.currentRoundIdx === rIdx && state.simState === "running" && (
                      <span className="st-round-live">진행 중</span>
                    )}
                  </div>
                  <div className="st-pools">
                    {round.pools.map(pool => (
                      <PoolCard
                        key={pool.id}
                        pool={pool}
                        players={state.players}
                        selectedMatchId={state.selectedMatchId}
                        trackedPlayerId={trackedPlayerId}
                        onSelectMatch={id => dispatch({ type: "SELECT_MATCH", id })}
                        visible={round.visible}
                      />
                    ))}
                  </div>
                </div>
                {rIdx < state.rounds.length - 1 && (
                  <div className="st-connector"><span className="st-connector-arrow">›</span></div>
                )}
              </React.Fragment>
            ))}

            {/* 다음 라운드 플레이스홀더 */}
            {state.simState !== "done" && state.rounds.length < state.totalRounds && (
              <>
                <div className="st-connector">
                  <span className="st-connector-arrow st-connector-arrow--muted">›</span>
                </div>
                <div className="st-round-col st-round-col--pending">
                  <div className="st-round-header">
                    <span className="st-round-label st-round-label--muted">{state.rounds.length + 1}차 경기</span>
                  </div>
                  <div className="st-pools-pending">
                    <span className="st-pending-text">결과 대기 중…</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Final standings (bracket 영역 하단) */}
          {state.simState === "done" && (
            <div className="st-standings">
              <h3 className="st-standings-title">최종 결과</h3>
              <div className="st-standings-list">
                {currentStandings.map((s, i) => (
                  <div key={s.playerId} className="st-standing-row">
                    <span className="st-standing-rank" style={i < 3 ? { color: RANK_COLORS[i] } : undefined}>
                      #{s.rank}
                    </span>
                    <span className="st-standing-name">{s.name}</span>
                    <span className="st-standing-record">{s.wins}승 {s.losses}패</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Ranking Sidebar */}
        <RankingSidebar
          standings={currentStandings}
          rankDeltaMap={rankDeltaMap}
          trackedPlayerId={trackedPlayerId}
          onTrack={setTrackedPlayerId}
        />
      </div>
    </div>
  );
};

export default SwissTournamentPage;
