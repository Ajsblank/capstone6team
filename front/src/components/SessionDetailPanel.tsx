import React, { useState, useEffect, useRef } from "react";
import { getAccessToken } from "../api/authApi";
import Breadcrumb from "./Breadcrumb";
import SwissTournamentViewer from "./SwissTournamentViewer";
import "./SessionDetailPanel.css";

// ─── Backend SSE types ─────────────────────────────────────────────────────────

export interface SessionMatch {
  match_id: number;
  user1_id: number;
  user2_id: number | null;
  winner: 0 | 1 | 2 | null;
  result: "WIN1" | "WIN2" | "DRAW" | "BYE" | null;
}

export interface SessionRound {
  round_number: number;
  status: "RUNNING" | "FINISHED" | "END";
  matches: SessionMatch[];
}

export interface SessionPayload {
  session_number: number;
  status: "RUNNING" | "FINISHED" | "END";
  total_rounds: number;
  rounds: SessionRound[];
}

type SseStatus = "connecting" | "connected" | "disconnected";

const BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");

interface Props {
  contestId: number;
  sessionNumber: number;
  onBack: () => void;
  myUserId?: number;
  hasVisualization?: boolean;
  onLogView?: (log: string) => void;
}

const SessionDetailPanel: React.FC<Props> = ({ contestId, sessionNumber, onBack, myUserId, hasVisualization, onLogView }) => {
  const [payload,   setPayload]   = useState<SessionPayload | null>(null);
  const [sseStatus, setSseStatus] = useState<SseStatus>("connecting");
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const token = getAccessToken() ?? "";
    const tag = `[SSE][contest=${contestId}][session=${sessionNumber}]`;
    const url = `${BASE_URL}/api/contests/${contestId}/${sessionNumber}/subscribe?token=${token}`;

    console.info(`${tag} 연결 시도 →`, url.replace(/token=[^&]*/, "token=***"));
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setSseStatus("connected");
      console.info(`${tag} ✅ 연결 성공`);
    };

    es.onerror = (e) => {
      setSseStatus("disconnected");
      console.error(`${tag} ❌ 연결 오류 (readyState=${es.readyState})`, e);
      es.close();
    };

    const handleInit = (e: MessageEvent) => {
      console.group(`${tag} 📥 [init]`);
      try {
        const parsed = JSON.parse(e.data) as SessionPayload;
        console.log("session_number:", parsed.session_number);
        console.log("status        :", parsed.status);
        console.log("total_rounds  :", parsed.total_rounds);
        console.log("rounds        :", parsed.rounds);
        console.groupEnd();
        setPayload(parsed);
      } catch (err) {
        console.warn("파싱 실패:", e.data);
        console.groupEnd();
      }
    };

    const handleUpdate = (e: MessageEvent) => {
      console.group(`${tag} 🔄 [update]`);
      try {
        const parsed = JSON.parse(e.data) as SessionPayload;
        const runningRound = parsed.rounds.find(r => r.status === "RUNNING");
        const resolvedCount = parsed.rounds.flatMap(r => r.matches).filter(m => m.winner !== null).length;
        console.log("status        :", parsed.status);
        console.log("현재 라운드   :", runningRound ? `Round ${runningRound.round_number}` : "없음 (종료)");
        console.log("완료 매치 수  :", resolvedCount);
        console.log("payload       :", parsed);
        console.groupEnd();
        setPayload(parsed);
        if (parsed.status === "END" || parsed.status === "FINISHED") {
          console.info(`${tag} 세션 종료 수신 → SSE 연결 해제`);
          es.close();
          setSseStatus("disconnected");
        }
      } catch (err) {
        console.warn("파싱 실패:", e.data);
        console.groupEnd();
      }
    };

    es.addEventListener("init",   handleInit);
    es.addEventListener("update", handleUpdate);

    return () => {
      console.info(`${tag} 🔌 구독 해제`);
      es.removeEventListener("init",   handleInit);
      es.removeEventListener("update", handleUpdate);
      es.close();
      esRef.current = null;
    };
  }, [contestId, sessionNumber]);

  return (
    <div className="sdp-container">

      {/* 헤더 */}
      <div className="sdp-header">
        <Breadcrumb dark items={[
          { label: "세션 목록", onClick: onBack },
          { label: `Session ${sessionNumber}` },
        ]} />
        <span className="sdp-header-title">
          Session {sessionNumber}
          {payload && (
            <span style={{ fontSize: "0.8rem", color: "#6b7280", marginLeft: 8 }}>
              ({(payload.status === "END" || payload.status === "FINISHED") ? "종료" : "진행 중"} · {payload.total_rounds}라운드)
            </span>
          )}
        </span>
        <span className={`sdp-sse-dot sdp-sse-dot--${sseStatus}`}>
          {sseStatus === "connected"    ? "● SSE 연결됨"  :
           sseStatus === "connecting"   ? "◌ SSE 연결 중" : "○ SSE 끊김"}
        </span>
      </div>

      {/* 연결 대기 안내 */}
      {!payload && (
        <div className="sdp-body">
          {sseStatus === "connecting" && (
            <div className="sdp-placeholder">
              <span className="sdp-spinner" />
              서버에 연결 중입니다...
            </div>
          )}
          {sseStatus === "connected" && (
            <div className="sdp-placeholder">데이터 수신 대기 중입니다.</div>
          )}
          {sseStatus === "disconnected" && (
            <div className="sdp-placeholder sdp-placeholder--error">SSE 연결이 끊겼습니다.</div>
          )}
        </div>
      )}

      {/* 토너먼트 시각화 */}
      {payload && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <SwissTournamentViewer
            payload={payload}
            myUserId={myUserId}
            contestId={contestId}
            hasVisualization={hasVisualization}
            onLogView={onLogView}
          />
        </div>
      )}

    </div>
  );
};

export default SessionDetailPanel;
