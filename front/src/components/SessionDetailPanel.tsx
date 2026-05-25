import React, { useState, useEffect, useRef } from "react";
import { getAccessToken } from "../api/authApi";
import "./SessionDetailPanel.css";

// ── 백엔드 SSE 포맷 (미구현 — 수신 시 구조에 맞춰 파싱) ──
export interface SessionMatch {
  matchId: number;
  player1Id: string | number;
  player2Id: string | number;
  result: "WIN_P1" | "WIN_P2" | "DRAW" | "PENDING";
  log?: string;
}

export interface SessionRound {
  roundNumber: number;
  status: "RUNNING" | "END" | "PLANNED";
  matches: SessionMatch[];
}

type SseStatus = "connecting" | "connected" | "disconnected";

const BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");

const RESULT_LABEL: Record<string, string> = {
  WIN_P1: "P1 승",
  WIN_P2: "P2 승",
  DRAW:   "무승부",
  PENDING: "진행 중",
};

interface Props {
  contestId: number;
  sessionNumber: number;
  onBack: () => void;
}

const SessionDetailPanel: React.FC<Props> = ({ contestId, sessionNumber, onBack }) => {
  const [rounds, setRounds]         = useState<SessionRound[]>([]);
  const [sseStatus, setSseStatus]   = useState<SseStatus>("connecting");
  const [activeRound, setActiveRound] = useState<number>(1);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const token = getAccessToken() ?? "";
    const url   = `${BASE_URL}/api/contests/${contestId}/${sessionNumber}?token=${token}`;
    const es    = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setSseStatus("connected");

    es.onerror = () => {
      setSseStatus("disconnected");
      es.close();
    };

    // 백엔드 구현 후 이벤트명에 맞게 추가
    const handleData = (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);

        // 전체 라운드 배열로 수신하는 경우
        if (Array.isArray(payload)) {
          setRounds(payload as SessionRound[]);
          return;
        }

        // 단일 라운드 업데이트인 경우
        if (payload.roundNumber !== undefined) {
          setRounds(prev => {
            const idx = prev.findIndex(r => r.roundNumber === payload.roundNumber);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = payload as SessionRound;
              return next;
            }
            return [...prev, payload as SessionRound]
              .sort((a, b) => a.roundNumber - b.roundNumber);
          });
          return;
        }

        // 단일 매치 결과인 경우
        if (payload.matchId !== undefined && payload.roundNumber !== undefined) {
          setRounds(prev => prev.map(r =>
            r.roundNumber === payload.roundNumber
              ? { ...r, matches: r.matches.map(m => m.matchId === payload.matchId ? { ...m, ...payload } : m) }
              : r
          ));
        }
      } catch {
        console.warn("[SessionDetailPanel] SSE 파싱 실패:", e.data);
      }
    };

    es.addEventListener("message",      handleData);
    es.addEventListener("round",        handleData);
    es.addEventListener("round-update", handleData);
    es.addEventListener("match-result", handleData);

    return () => {
      es.removeEventListener("message",      handleData);
      es.removeEventListener("round",        handleData);
      es.removeEventListener("round-update", handleData);
      es.removeEventListener("match-result", handleData);
      es.close();
      esRef.current = null;
    };
  }, [contestId, sessionNumber]);

  // 데이터 수신 시 진행 중인 라운드로 자동 이동
  useEffect(() => {
    const running = rounds.find(r => r.status === "RUNNING");
    if (running) setActiveRound(running.roundNumber);
  }, [rounds]);

  const currentRound = rounds.find(r => r.roundNumber === activeRound);

  return (
    <div className="sdp-container">
      {/* 헤더 */}
      <div className="sdp-header">
        <button className="sdp-back-btn" onClick={onBack}>← 세션 목록</button>
        <span className="sdp-header-title">Session {sessionNumber}</span>
        <span className={`sdp-sse-dot sdp-sse-dot--${sseStatus}`}>
          {sseStatus === "connected" ? "● 연결됨" : sseStatus === "connecting" ? "◌ 연결 중" : "○ 끊김"}
        </span>
      </div>

      {/* 라운드 탭 */}
      {rounds.length > 0 && (
        <div className="sdp-round-tabs">
          {rounds.map(r => (
            <button
              key={r.roundNumber}
              className={[
                "sdp-round-tab",
                activeRound === r.roundNumber ? "sdp-round-tab--active" : "",
                r.status === "RUNNING" ? "sdp-round-tab--running" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => setActiveRound(r.roundNumber)}
            >
              Round {r.roundNumber}
              {r.status === "RUNNING" && <span className="sdp-round-live"> ●</span>}
            </button>
          ))}
        </div>
      )}

      {/* 본문 */}
      <div className="sdp-body">
        {sseStatus === "connecting" && rounds.length === 0 && (
          <div className="sdp-placeholder">
            <span className="sdp-spinner" />
            서버에 연결 중입니다...
          </div>
        )}

        {sseStatus === "connected" && rounds.length === 0 && (
          <div className="sdp-placeholder">데이터 수신 대기 중입니다.</div>
        )}

        {sseStatus === "disconnected" && rounds.length === 0 && (
          <div className="sdp-placeholder sdp-placeholder--error">SSE 연결이 끊겼습니다.</div>
        )}

        {currentRound && (
          <div className="sdp-round-body">
            <div className="sdp-round-info">
              <span className="sdp-round-title">Round {currentRound.roundNumber}</span>
              <span className={`sdp-round-badge sdp-round-badge--${currentRound.status.toLowerCase()}`}>
                {currentRound.status === "RUNNING" ? "● 진행 중" :
                 currentRound.status === "END"     ? "종료" : "대기"}
              </span>
            </div>

            {currentRound.matches.length === 0 ? (
              <div className="sdp-placeholder">매치 정보가 없습니다.</div>
            ) : (
              <table className="sdp-match-table">
                <thead>
                  <tr>
                    <th>매치</th>
                    <th>P1</th>
                    <th></th>
                    <th>P2</th>
                    <th>결과</th>
                  </tr>
                </thead>
                <tbody>
                  {currentRound.matches.map((m, i) => (
                    <tr key={m.matchId} className="sdp-match-row">
                      <td className="sdp-match-num">#{i + 1}</td>
                      <td className="sdp-player">{m.player1Id}</td>
                      <td className="sdp-vs">vs</td>
                      <td className="sdp-player">{m.player2Id}</td>
                      <td>
                        <span className={`sdp-result sdp-result--${m.result.toLowerCase()}`}>
                          {RESULT_LABEL[m.result] ?? m.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionDetailPanel;
