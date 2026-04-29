import React, { useState } from "react";
import { LocalSubmission } from "../pages/BattleSubmitPage";
import { BattleMatchResult } from "../api/sseApi";
import "./MySubmissionsTab.css";

interface Props {
  localSubmissions: LocalSubmission[];
  onLogClick: (log: string) => void;
}

const LANGUAGE_LABELS: Record<string, string> = {
  cpp: "C++", java: "Java", python: "Python",
};

function formatDate(d: Date): string {
  return d.toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

// 승자 문자열 → 표시 텍스트
// TODO: 백엔드 winner 값 확정 후 매핑 수정 (현재 "player1" = 나, 그 외 = 샘플 AI로 가정)
function winnerLabel(winner: string): { text: string; isMe: boolean } {
  const lower = winner.toLowerCase();
  if (lower === "player1" || lower === "me" || lower === "user") {
    return { text: "나", isMe: true };
  }
  return { text: "샘플 AI", isMe: false };
}

// ── 매치 상세 행 ──
function MatchRow({ match, index, onLogClick }: {
  match: BattleMatchResult;
  index: number;
  onLogClick: (log: string) => void;
}) {
  const { text, isMe } = winnerLabel(match.winner);
  return (
    <tr className="ms-match-row">
      <td className="ms-match-num">#{index + 1}</td>
      <td>
        <span className={isMe ? "ms-winner--me" : "ms-winner--ai"}>{text}</span>
      </td>
      <td>
        <button
          className="ms-log-btn"
          onClick={() => onLogClick(match.log)}
          title="로그 분석 페이지에서 확인"
        >
          로그 보기 →
        </button>
      </td>
    </tr>
  );
}

// ── 제출 아이템 ──
function SubmissionItem({ sub, onLogClick }: {
  sub: LocalSubmission;
  onLogClick: (log: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const wins   = sub.matches.filter(m => winnerLabel(m.winner).isMe).length;
  const losses = sub.matches.length - wins;

  return (
    <div className="ms-item">
      <div className="ms-item-header">
        <span className="ms-item-date">{formatDate(sub.submittedAt)}</span>
        <span className="ms-item-lang">{LANGUAGE_LABELS[sub.language] ?? sub.language.toUpperCase()}</span>

        {/* 승패 카운트 — SSE 수신될 때마다 실시간 갱신 */}
        <span className="ms-item-record">
          {sub.matches.length === 0 ? (
            <span className="ms-pending">채점 중...</span>
          ) : (
            <>
              <span className="ms-win">{wins}승</span>
              {" "}
              <span className="ms-loss">{losses}패</span>
              <span className="ms-total"> / {sub.matches.length}전</span>
            </>
          )}
        </span>

        {/* 자세히 버튼 */}
        <button
          className="ms-expand-btn"
          onClick={() => setExpanded(v => !v)}
          title="대전 상세 보기"
          disabled={sub.matches.length === 0}
        >
          {expanded ? "▲" : "▼"}
        </button>
      </div>

      {/* 매치 상세 */}
      {expanded && sub.matches.length > 0 && (
        <div className="ms-item-body">
          <table className="ms-match-table">
            <thead>
              <tr>
                <th>매치</th>
                <th>승자</th>
                <th>로그</th>
              </tr>
            </thead>
            <tbody>
              {sub.matches.map((m, i) => (
                <MatchRow key={m.matchId} match={m} index={i} onLogClick={onLogClick} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── 탭 컴포넌트 ──
const MySubmissionsTab: React.FC<Props> = ({ localSubmissions, onLogClick }) => {
  return (
    <div className="ms-container">
      <div className="ms-header-row">
        <h2 className="ms-title">내 제출 이력</h2>
      </div>

      {localSubmissions.length === 0 ? (
        <div className="ms-empty-state">아직 제출한 코드가 없습니다.</div>
      ) : (
        <div className="ms-list">
          {localSubmissions.map((sub, i) => (
            <SubmissionItem key={i} sub={sub} onLogClick={onLogClick} />
          ))}
        </div>
      )}
    </div>
  );
};

export default MySubmissionsTab;
