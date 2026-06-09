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
  participants?: Record<string, string>;
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

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setSseStatus("connected");
    };

    es.onerror = () => {
      setSseStatus("disconnected");
      es.close();
    };

    const handleInit = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as SessionPayload;
        setPayload(parsed);
      } catch {
        // 파싱 실패 무시
      }
    };

    const handleUpdate = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as SessionPayload;
        setPayload(parsed);
        if (parsed.status === "END" || parsed.status === "FINISHED") {
          es.close();
          setSseStatus("disconnected");
        }
      } catch {
        // 파싱 실패 무시
      }
    };

    es.addEventListener("init",   handleInit);
    es.addEventListener("update", handleUpdate);

    return () => {
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
      </div>

      {/* 로딩 / 오류 */}
      {!payload && (
        <div className="sdp-body">
          {sseStatus !== "disconnected" ? (
            <div className="sdp-placeholder">
              <span className="sdp-spinner" />
              불러오는 중...
            </div>
          ) : (
            <div className="sdp-placeholder sdp-placeholder--error">데이터를 불러오지 못했습니다.</div>
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
